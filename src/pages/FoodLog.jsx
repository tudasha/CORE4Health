import { useState, useEffect, useRef } from 'react';
import { useHealth } from '../hooks/useHealth';
import { Search, Plus, X, Trash2, UtensilsCrossed, Loader } from 'lucide-react';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_ICONS = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
const CALORIE_GOAL = 2000;

// Parse FatSecret serving data into a flat macro object
function parseServing(servings) {
  if (!servings) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const s = Array.isArray(servings.serving) ? servings.serving[0] : servings.serving;
  return {
    calories: parseFloat(s?.calories) || 0,
    protein:  parseFloat(s?.protein)  || 0,
    carbs:    parseFloat(s?.carbohydrate) || 0,
    fat:      parseFloat(s?.fat)      || 0,
  };
}

function MacroBar({ label, val, max, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
      <span style={{ width: 52, fontSize:'0.72rem', color:'var(--text-secondary)', flexShrink:0 }}>{label}</span>
      <div className="progress-track" style={{ flex:1, height:5 }}>
        <div className="progress-fill" style={{ width:`${Math.min(val/max,1)*100}%`, background: color }} />
      </div>
      <span style={{ width: 36, fontSize:'0.72rem', fontWeight:700, color, textAlign:'right', flexShrink:0 }}>{Math.round(val)}g</span>
    </div>
  );
}

export default function FoodLog() {
  const { meals, totals, loading, fetchMeals, addMeal, deleteMeal, searchFood, getFoodDetails } = useHealth();

  // Modal state
  const [showModal,  setShowModal]  = useState(false);
  const [mealType,   setMealType]   = useState('lunch');

  // Search state
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const searchTimer = useRef(null);

  // Selected food / manual form
  const [selected,   setSelected]  = useState(null);  // { name, icon, calories, protein, carbs, fat }
  const [form,       setForm]      = useState({ name:'', icon:'🍽️', calories:'', protein:'', carbs:'', fat:'' });

  useEffect(() => { fetchMeals(); }, []);

  // Debounced food search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const foods = await searchFood(query);
      setResults(foods.slice(0, 12));
      setSearching(false);
    }, 500);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  async function handleSelectFood(food) {
    // Get full macros from food.get.v4
    const detail = await getFoodDetails(food.food_id);
    const macros = parseServing(detail?.servings);
    setSelected({
      name:     food.food_name,
      icon:     MEAL_ICONS[mealType],
      ...macros,
    });
    setForm({
      name:     food.food_name,
      icon:     MEAL_ICONS[mealType],
      calories: String(Math.round(macros.calories)),
      protein:  String(Math.round(macros.protein)),
      carbs:    String(Math.round(macros.carbs)),
      fat:      String(Math.round(macros.fat)),
    });
    setResults([]);
    setQuery('');
  }

  async function handleAdd() {
    if (!form.name) return;
    await addMeal({
      name:      form.name,
      icon:      form.icon || MEAL_ICONS[mealType],
      calories:  parseFloat(form.calories) || 0,
      protein:   parseFloat(form.protein)  || 0,
      carbs:     parseFloat(form.carbs)    || 0,
      fat:       parseFloat(form.fat)      || 0,
      meal_type: mealType,
    });
    setShowModal(false);
    setForm({ name:'', icon:'🍽️', calories:'', protein:'', carbs:'', fat:'' });
    setSelected(null);
    setQuery('');
  }

  const calPct = Math.min(totals.calories / CALORIE_GOAL, 1);

  // Group meals by type
  const grouped = MEAL_TYPES.reduce((acc, t) => {
    acc[t] = meals.filter(m => m.meal_type === t);
    return acc;
  }, {});

  return (
    <div className="page">
      {/* Header */}
      <div className="flex-between page-header">
        <div>
          <div className="page-title">Food Log</div>
          <div className="page-subtitle">FatSecret · Real-time calories</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} id="btn-add-food"
          style={{ width:'auto', padding:'10px 16px', gap:6 }}>
          <Plus size={18} /> Add
        </button>
      </div>

      {/* Daily summary card */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="flex-between" style={{ marginBottom: 10 }}>
          <div>
            <div style={{ fontSize:'1.6rem', fontWeight:900, color:'var(--accent-amber)', lineHeight:1, letterSpacing:'-0.03em' }}>
              {Math.round(totals.calories)}
            </div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>of {CALORIE_GOAL} kcal</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
            <span className="pill pill-amber">{Math.round(calPct * 100)}% daily goal</span>
            <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{Math.max(CALORIE_GOAL - Math.round(totals.calories), 0)} kcal remaining</span>
          </div>
        </div>
        <div className="progress-track" style={{ marginBottom: 12 }}>
          <div className="progress-fill" style={{
            width:`${calPct*100}%`,
            background:'linear-gradient(90deg, var(--accent-amber), var(--accent-rose))'
          }} />
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
        if (group.length === 0) return null;
        const groupCal = group.reduce((s, m) => s + (parseFloat(m.calories)||0), 0);
        return (
          <div key={type} className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="flex-between" style={{ marginBottom: 10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:'1.3rem' }}>{MEAL_ICONS[type]}</span>
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
                <button
                  onClick={() => deleteMeal(m.id)}
                  style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:'4px 0 4px 8px', flexShrink:0 }}
                  id={`delete-meal-${m.id}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {meals.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--text-muted)' }}>
          <UtensilsCrossed size={40} style={{ opacity:0.3, marginBottom:12 }} />
          <div style={{ fontWeight:600 }}>No meals logged today</div>
          <div style={{ fontSize:'0.82rem', marginTop:4 }}>Tap + Add to log your first meal</div>
        </div>
      )}

      {/* ── Add Meal Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-sheet">
            <div className="modal-handle" />

            <div className="flex-between" style={{ marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--text-primary)' }}>Add Meal</div>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}
                id="btn-close-modal"><X size={20} /></button>
            </div>

            {/* Meal type selector */}
            <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
              {MEAL_TYPES.map(t => (
                <button key={t} onClick={() => { setMealType(t); setForm(f => ({...f, icon: MEAL_ICONS[t]})); }}
                  id={`meal-type-${t}`}
                  style={{
                    flexShrink:0, padding:'6px 14px', borderRadius:99, border:'1px solid',
                    borderColor: mealType===t ? 'var(--accent-green)' : 'var(--border)',
                    background: mealType===t ? 'rgba(34,197,94,0.12)' : 'transparent',
                    color: mealType===t ? 'var(--accent-green)' : 'var(--text-secondary)',
                    fontWeight:600, fontSize:'0.8rem', cursor:'pointer', fontFamily:'Outfit',
                    display:'flex', alignItems:'center', gap:6,
                  }}>
                  {MEAL_ICONS[t]} <span style={{ textTransform:'capitalize' }}>{t}</span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ position:'relative', marginBottom:12 }}>
              <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}>
                {searching ? <Loader size={16} style={{ animation:'spin 0.8s linear infinite' }} /> : <Search size={16} />}
              </span>
              <input
                id="food-search-input"
                className="input"
                style={{ paddingLeft:38 }}
                placeholder="Search food (FatSecret)…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoComplete="off"
              />
              {query && (
                <button onClick={() => { setQuery(''); setResults([]); }}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div style={{ background:'var(--bg-input)', borderRadius:12, marginBottom:12, maxHeight:220, overflowY:'auto' }}>
                {results.map(food => (
                  <div key={food.food_id} className="food-result" onClick={() => handleSelectFood(food)} id={`food-${food.food_id}`}>
                    <span style={{ fontSize:'1.3rem' }}>{MEAL_ICONS[mealType]}</span>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'0.875rem', color:'var(--text-primary)' }}>{food.food_name}</div>
                      <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{food.food_description?.split('|')[0]?.trim()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manual form */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div className="form-group">
                <label className="form-label">Food name *</label>
                <input id="food-name" className="input" placeholder="e.g. Grilled Chicken Breast"
                  value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Calories (kcal)</label>
                  <input id="food-calories" className="input" type="number" inputMode="decimal" placeholder="250"
                    value={form.calories} onChange={e => setForm(f => ({...f, calories:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Protein (g)</label>
                  <input id="food-protein" className="input" type="number" inputMode="decimal" placeholder="30"
                    value={form.protein} onChange={e => setForm(f => ({...f, protein:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Carbs (g)</label>
                  <input id="food-carbs" className="input" type="number" inputMode="decimal" placeholder="15"
                    value={form.carbs} onChange={e => setForm(f => ({...f, carbs:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fat (g)</label>
                  <input id="food-fat" className="input" type="number" inputMode="decimal" placeholder="8"
                    value={form.fat} onChange={e => setForm(f => ({...f, fat:e.target.value}))} />
                </div>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleAdd} disabled={loading || !form.name}
              id="btn-log-meal" style={{ marginTop:16 }}>
              {loading ? 'Saving…' : `Log ${mealType.charAt(0).toUpperCase()+mealType.slice(1)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
