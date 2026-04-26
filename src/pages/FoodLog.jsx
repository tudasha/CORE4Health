import { useState, useEffect, useRef } from 'react';
import { Camera, CameraResultType } from '@capacitor/camera';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { useHealth } from '../hooks/useHealth';
import { Search, Plus, X, Trash2, UtensilsCrossed, Loader, CheckCircle, AlertCircle, Camera as CameraIcon, ScanLine, Sparkles } from 'lucide-react';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_ICONS = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
const CALORIE_GOAL = 2000;

function parseServing(servings) {
  if (!servings) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const s = Array.isArray(servings.serving) ? servings.serving[0] : servings.serving;
  if (!s) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  return {
    calories: parseFloat(s.calories)     || 0,
    protein:  parseFloat(s.protein)      || 0,
    carbs:    parseFloat(s.carbohydrate) || 0,
    fat:      parseFloat(s.fat)          || 0,
  };
}

function Toast({ message, type = 'success', onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, []);
  return (
    <div className="toast" style={{
      borderColor: type === 'success' ? 'rgba(34,197,94,0.4)' : 'rgba(244,63,94,0.4)',
      color:       type === 'success' ? 'var(--accent-green)' : 'var(--accent-rose)',
    }}>
      {type === 'success' ? <CheckCircle size={14} style={{ display:'inline', marginRight:6 }}/> : <AlertCircle size={14} style={{ display:'inline', marginRight:6 }}/>}
      {message}
    </div>
  );
}

function MacroBar({ label, val, max, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
      <span style={{ width: 52, fontSize:'0.72rem', color:'var(--text-secondary)', flexShrink:0 }}>{label}</span>
      <div className="progress-track" style={{ flex:1, height:5 }}>
        <div className="progress-fill" style={{ width:`${Math.min(val/max,1)*100}%`, background: color }}/>
      </div>
      <span style={{ width: 36, fontSize:'0.72rem', fontWeight:700, color, textAlign:'right', flexShrink:0 }}>{Math.round(val)}g</span>
    </div>
  );
}

const emptyForm = { name:'', icon:'🍽️', calories:'', protein:'', carbs:'', fat:'' };

export default function FoodLog() {
  const { meals, totals, loading, fetchMeals, addMeal, deleteMeal, searchFood, getFoodDetails, estimateWithAI, searchBarcode } = useHealth();

  const [showModal,  setShowModal]  = useState(false);
  const [mealType,   setMealType]   = useState('lunch');
  const [toast,      setToast]      = useState(null);

  // Search state
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [searchErr,  setSearchErr]  = useState('');
  const searchTimer = useRef(null);

  // AI & Barcode state
  const [aiText, setAiText] = useState('');
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [scanningBarcode, setScanningBarcode] = useState(false);

  // Form state
  const [form, setForm]             = useState(emptyForm);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => { fetchMeals(); }, []);

  // Debounced FatSecret search
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearchErr(''); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true); setSearchErr('');
      const { foods, error } = await searchFood(query);
      setSearching(false);
      if (error) {
        setSearchErr(error.includes('credentials') || error.includes('500') ? 'FatSecret API not configured on server yet' : error);
        setResults([]);
      } else {
        setResults(foods.slice(0, 12));
        if (foods.length === 0) setSearchErr('No results found');
      }
    }, 500);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  // ── Smart Inputs ─────────────────────────────────────────────

  async function handleCamera() {
    try {
      const image = await Camera.getPhoto({ quality: 50, allowEditing: false, resultType: CameraResultType.Base64 });
      setAnalyzingImage(true);
      const { success, estimation, error } = await estimateWithAI(null, image.base64String);
      setAnalyzingImage(false);
      if (success && estimation) {
        setForm({
          name: estimation.name || 'AI Estimate', icon: MEAL_ICONS[mealType],
          calories: String(estimation.calories || 0), protein: String(estimation.protein || 0),
          carbs: String(estimation.carbs || 0), fat: String(estimation.fat || 0)
        });
        setToast({ message: 'AI analyzed your photo!', type: 'success' });
      } else { setToast({ message: error || 'Failed to analyze image', type: 'error' }); }
    } catch (e) {
      console.warn('Camera error', e);
      setAnalyzingImage(false);
    }
  }

  async function handleBarcode() {
    try {
      await BarcodeScanner.requestPermissions();
      setScanningBarcode(true);
      const { barcodes } = await BarcodeScanner.scan();
      setScanningBarcode(false);

      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue;
        setSearching(true);
        const { success, food, error } = await searchBarcode(code);
        setSearching(false);
        if (success && food) {
          const macros = parseServing(food.servings);
          setForm({
            name: food.food_name, icon: MEAL_ICONS[mealType],
            calories: String(Math.round(macros.calories)), protein: String(Math.round(macros.protein)),
            carbs: String(Math.round(macros.carbs)), fat: String(Math.round(macros.fat)),
          });
          setToast({ message: 'Barcode loaded from FatSecret!', type: 'success' });
        } else { setToast({ message: error || 'Barcode not found', type: 'error' }); }
      }
    } catch (e) {
      console.warn('Barcode error', e);
      setScanningBarcode(false);
    }
  }

  async function handleAIText() {
    if (!aiText.trim()) return;
    setAnalyzingImage(true);
    const { success, estimation, error } = await estimateWithAI(aiText, null);
    setAnalyzingImage(false);
    if (success && estimation) {
      setForm({
        name: estimation.name || aiText.split(' ')[0], icon: MEAL_ICONS[mealType],
        calories: String(estimation.calories || 0), protein: String(estimation.protein || 0),
        carbs: String(estimation.carbs || 0), fat: String(estimation.fat || 0)
      });
      setAiText('');
      setToast({ message: 'AI estimated your meal!', type: 'success' });
    } else { setToast({ message: error || 'Failed to analyze text', type: 'error' }); }
  }

  // ── Basic Handlers ───────────────────────────────────────────

  async function handleSelectFood(food) {
    setLoadingDetail(true); setResults([]); setQuery('');
    const detail = await getFoodDetails(food.food_id);
    setLoadingDetail(false);
    const macros = parseServing(detail?.servings);
    setForm({
      name: food.food_name, icon: MEAL_ICONS[mealType],
      calories: String(Math.round(macros.calories)), protein: String(Math.round(macros.protein)),
      carbs: String(Math.round(macros.carbs)), fat: String(Math.round(macros.fat)),
    });
  }

  async function handleAdd() {
    if (!form.name.trim()) { setToast({ message: 'Please enter a food name', type: 'error' }); return; }
    const result = await addMeal({
      name: form.name.trim(), icon: form.icon || MEAL_ICONS[mealType],
      calories: parseFloat(form.calories)||0, protein: parseFloat(form.protein)||0,
      carbs: parseFloat(form.carbs)||0, fat: parseFloat(form.fat)||0, meal_type: mealType,
    });
    if (result?.success) {
      closeModal();
      setToast({ message: `✓ ${form.name} logged`, type: 'success' });
    } else { setToast({ message: result?.error || 'Failed to save meal', type: 'error' }); }
  }

  function openModal() { setForm({...emptyForm, icon: MEAL_ICONS[mealType]}); setQuery(''); setAiText(''); setResults([]); setSearchErr(''); setShowModal(true); }
  function closeModal() { setShowModal(false); setForm(emptyForm); setQuery(''); setAiText(''); setResults([]); setSearchErr(''); }

  const calPct   = Math.min(totals.calories / CALORIE_GOAL, 1);
  const grouped  = MEAL_TYPES.reduce((acc, t) => { acc[t] = meals.filter(m => m.meal_type === t); return acc; }, {});

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <div className="flex-between page-header">
        <div>
          <div className="page-title">Food Log</div>
          <div className="page-subtitle">{meals.length === 0 ? 'No meals logged' : `${meals.length} meals logged`}</div>
        </div>
        <button className="btn btn-primary" onClick={openModal} id="btn-add-food" style={{ width:'auto', padding:'10px 16px', gap:6 }}><Plus size={18}/> Add</button>
      </div>

      {/* Daily summary */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="flex-between" style={{ marginBottom: 10 }}>
          <div>
            <div style={{ fontSize:'1.6rem', fontWeight:900, color:'var(--accent-amber)', lineHeight:1, letterSpacing:'-0.03em' }}>{Math.round(totals.calories)}</div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>of {CALORIE_GOAL} kcal</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
            <span className="pill pill-amber">{Math.round(calPct * 100)}% daily goal</span>
            <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{Math.max(CALORIE_GOAL - Math.round(totals.calories), 0)} kcal left</span>
          </div>
        </div>
        <div className="progress-track" style={{ marginBottom: 12 }}>
          <div className="progress-fill" style={{ width:`${calPct*100}%`, background:'linear-gradient(90deg, var(--accent-amber), var(--accent-rose))' }}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <MacroBar label="Protein" val={totals.protein} max={160} color="var(--accent-rose)" />
          <MacroBar label="Carbs"   val={totals.carbs}   max={250} color="var(--accent-amber)" />
          <MacroBar label="Fat"     val={totals.fat}      max={65}  color="var(--accent-teal)" />
        </div>
      </div>

      {/* Meal groups */}
      {MEAL_TYPES.map(type => {
        const group = grouped[type];
        if (!group?.length) return null;
        const groupCal = group.reduce((s, m) => s + (parseFloat(m.calories) || 0), 0);
        return (
          <div key={type} className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="flex-between" style={{ marginBottom: 10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:'1.2rem' }}>{MEAL_ICONS[type]}</span>
                <span style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-primary)', textTransform:'capitalize' }}>{type}</span>
              </div>
              <span className="pill pill-amber">{Math.round(groupCal)} kcal</span>
            </div>
            {group.map(m => (
              <div key={m.id} className="meal-item">
                <span className="meal-icon">{m.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="meal-name" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
                  <div className="meal-macros">P {Math.round(m.protein)}g · C {Math.round(m.carbs)}g · F {Math.round(m.fat)}g</div>
                </div>
                <div className="meal-kcal">{Math.round(m.calories)}</div>
                <button onClick={() => deleteMeal(m.id)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px 0 4px 8px', flexShrink:0 }} id={`delete-meal-${m.id}`}><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
        );
      })}

      {meals.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
          <UtensilsCrossed size={40} style={{ opacity:0.3, marginBottom:12 }}/>
          <div style={{ fontWeight:600 }}>No meals logged today</div>
        </div>
      )}

      {/* ── Add Meal Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-sheet">
            <div className="modal-handle"/>

            <div className="flex-between" style={{ marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--text-primary)' }}>Add Meal</div>
              <button onClick={closeModal} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }} id="btn-close-modal"><X size={20}/></button>
            </div>

            <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
              {MEAL_TYPES.map(t => (
                <button key={t} onClick={() => { setMealType(t); setForm(f => ({...f, icon: MEAL_ICONS[t]})); }} id={`meal-type-${t}`} style={{
                  flexShrink:0, padding:'6px 14px', borderRadius:99, border:'1px solid',
                  borderColor: mealType===t ? 'var(--accent-green)' : 'var(--border)',
                  background:  mealType===t ? 'rgba(34,197,94,0.12)' : 'transparent',
                  color:       mealType===t ? 'var(--accent-green)' : 'var(--text-secondary)',
                  fontWeight:600, fontSize:'0.8rem', cursor:'pointer', display:'flex', alignItems:'center', gap:6,
                }}>
                  {MEAL_ICONS[t]} <span style={{ textTransform:'capitalize' }}>{t}</span>
                </button>
              ))}
            </div>

            {/* Smart Actions (Camera / Barcode / AI Text) */}
            <div className="grid-3" style={{ marginBottom: 12 }}>
              <button onClick={handleCamera} disabled={analyzingImage || scanningBarcode} className="card btn-ghost" style={{ padding:'10px', display:'flex', flexDirection:'column', alignItems:'center', gap:6, borderColor:'rgba(168,85,247,0.3)', background:'rgba(168,85,247,0.03)' }}>
                {analyzingImage ? <Loader size={20} className="spin" color="var(--accent-purple)"/> : <CameraIcon size={20} color="var(--accent-purple)"/>}
                <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--accent-purple)' }}>Snap Photo</span>
              </button>
              <button onClick={handleBarcode} disabled={scanningBarcode || analyzingImage} className="card btn-ghost" style={{ padding:'10px', display:'flex', flexDirection:'column', alignItems:'center', gap:6, borderColor:'rgba(20,184,166,0.3)', background:'rgba(20,184,166,0.03)' }}>
                {scanningBarcode ? <Loader size={20} className="spin" color="var(--accent-teal)"/> : <ScanLine size={20} color="var(--accent-teal)"/>}
                <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--accent-teal)' }}>Scan Barcode</span>
              </button>
              <button onClick={() => document.getElementById('ai-text-input')?.focus()} className="card btn-ghost" style={{ padding:'10px', display:'flex', flexDirection:'column', alignItems:'center', gap:6, borderColor:'rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.03)' }}>
                <Sparkles size={20} color="var(--accent-amber)"/>
                <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--accent-amber)' }}>Ask AI</span>
              </button>
            </div>

            <div style={{ position:'relative', marginBottom: 12 }}>
              <input id="ai-text-input" className="input" placeholder="Type a meal for AI (e.g. 2 slices of pizza)..." value={aiText} onChange={e=>setAiText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAIText()} />
              {aiText && (
                 <button onClick={handleAIText} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'var(--accent-amber)', border:'none', borderRadius:6, color:'#000', padding:'6px', cursor:'pointer', display:'flex', alignItems:'center' }}>
                    <Sparkles size={14}/>
                 </button>
              )}
            </div>

            {/* Traditional Search */}
            <div style={{ position:'relative', marginBottom: searchErr ? 6 : 12 }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}>
                {searching || loadingDetail ? <Loader size={16} style={{ animation:'spin 0.8s linear infinite' }}/> : <Search size={16}/>}
              </span>
              <input className="input" style={{ paddingLeft:38 }} placeholder="Or search FatSecret database..." value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" />
              {query && (
                <button onClick={() => { setQuery(''); setResults([]); setSearchErr(''); }} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={14}/></button>
              )}
            </div>

            {searchErr && <div style={{ fontSize:'0.78rem', color:'var(--accent-amber)', marginBottom:10, padding:'8px 10px', background:'rgba(245,158,11,0.08)', borderRadius:8 }}>⚠️ {searchErr}</div>}
            
            {results.length > 0 && (
              <div style={{ background:'var(--bg-input)', borderRadius:12, marginBottom:12, maxHeight:150, overflowY:'auto' }}>
                {results.map(food => (
                  <div key={food.food_id} className="food-result" onClick={() => handleSelectFood(food)}>
                    <span style={{ fontSize:'1.2rem' }}>{MEAL_ICONS[mealType]}</span>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'0.875rem', color:'var(--text-primary)' }}>{food.food_name}</div>
                      <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{food.food_description?.split('|')[0]?.trim().slice(0, 60)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manual form */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div className="form-group">
                <label className="form-label">Food name *</label>
                <input className="input" placeholder="e.g. Grilled Chicken Breast" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))}/>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Calories</label><input className="input" type="number" value={form.calories} onChange={e => setForm(f => ({...f, calories:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Protein (g)</label><input className="input" type="number" value={form.protein} onChange={e => setForm(f => ({...f, protein:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Carbs (g)</label><input className="input" type="number" value={form.carbs} onChange={e => setForm(f => ({...f, carbs:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Fat (g)</label><input className="input" type="number" value={form.fat} onChange={e => setForm(f => ({...f, fat:e.target.value}))}/></div>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleAdd} disabled={loading || !form.name.trim()} style={{ marginTop:16 }}>
              {loading ? 'Saving…' : `Log ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
