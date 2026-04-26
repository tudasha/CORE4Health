import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { useHealth } from '../hooks/useHealth';
import { useSteps } from '../context/StepContext';
import { Footprints, Flame, Beef, Wheat, Droplets, LogOut, ChevronRight, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

const CALORIE_GOAL = 2000;
const STEP_GOAL    = 10000;

function Ring({ value, max, color, size = 120, strokeWidth = 10, children }) {
  const r     = (size - strokeWidth) / 2;
  const circ  = 2 * Math.PI * r;
  const pct   = Math.min(value / max, 1);
  const dash  = pct * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <foreignObject x="0" y="0" width={size} height={size} style={{ transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}>
        <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          {children}
        </div>
      </foreignObject>
    </svg>
  );
}

export default function Dashboard() {
  const { user, logout }            = useAuth();
  const { healthUpdate, connected } = useWebSocket();
  const { meals, stepHistory, totals, error, fetchMeals, fetchStepHistory } = useHealth();
  const { totalToday: todaySteps }  = useSteps();
  const navigate  = useNavigate();
  const location  = useLocation();

  const refresh = useCallback(() => {
    fetchMeals();
    fetchStepHistory(7);
  }, [fetchMeals, fetchStepHistory]);

  // Fetch on mount
  useEffect(() => { refresh(); }, []);

  // Re-fetch when navigating back to this tab
  useEffect(() => { if (location.pathname === '/') refresh(); }, [location.pathname]);

  // Re-fetch when browser tab becomes visible again
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // Live WS health updates
  useEffect(() => {
    if (!healthUpdate) return;
    if (healthUpdate.kind === 'steps' || healthUpdate.kind === 'meal') refresh();
  }, [healthUpdate]);

  const calPct   = Math.min(totals.calories / CALORIE_GOAL, 1);
  const stepPct  = Math.min(todaySteps / STEP_GOAL, 1);
  const today    = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // Weekly bar chart data
  const days = ['M','T','W','T','F','S','S'];
  const maxSteps = Math.max(...stepHistory.map(h => Number(h.steps) || 0), 1);
  const barData = Array.from({ length: 7 }, (_, i) => {
    const entry = stepHistory[stepHistory.length - 7 + i];
    return entry ? Number(entry.steps) : 0;
  });

  return (
    <div className="page">
      {/* Server error banner */}
      {error && (
        <div style={{
          padding: '10px 14px', marginBottom: 12,
          borderRadius: 10, background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.25)',
          fontSize: '0.78rem', color: 'var(--accent-amber)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={14} style={{ flexShrink:0 }}/>
          <span style={{ flex:1 }}>{error}</span>
          <button onClick={refresh} style={{ background:'none', border:'none', color:'var(--accent-amber)', cursor:'pointer' }}>
            <RefreshCw size={14}/>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex-between page-header">
        <div>
          <div className="page-title">Good {getGreeting()} 👋</div>
          <div className="page-subtitle">{today}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className={`live-dot${connected ? '' : ' offline'}`} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{connected ? 'Live' : 'Offline'}</span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={() => { logout(); navigate('/login'); }} id="btn-logout" style={{ width: 38, height: 38, padding: 0, borderRadius: 10 }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Hero — Steps + Calories rings */}
      <div className="card" style={{ padding: 24, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          {/* Steps ring */}
          <div className="ring-wrap">
            <Ring value={todaySteps} max={STEP_GOAL} color="var(--accent-green)" size={130} strokeWidth={11}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{todaySteps.toLocaleString()}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>/ {STEP_GOAL.toLocaleString()}</div>
            </Ring>
            <div className="ring-label" style={{ display:'flex', alignItems:'center', gap:4 }}>
              <Footprints size={12} color="var(--accent-green)" /> Steps
            </div>
          </div>

          {/* Calories ring */}
          <div className="ring-wrap">
            <Ring value={totals.calories} max={CALORIE_GOAL} color="var(--accent-amber)" size={130} strokeWidth={11}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{Math.round(totals.calories)}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>kcal</div>
            </Ring>
            <div className="ring-label" style={{ display:'flex', alignItems:'center', gap:4 }}>
              <Flame size={12} color="var(--accent-amber)" /> Calories
            </div>
          </div>
        </div>
      </div>

      {/* Macros */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="section-label">Today's Macros</div>
        {[
          { label: 'Protein',     val: totals.protein, max: 160, unit: 'g', color: 'var(--accent-rose)',   Icon: Beef },
          { label: 'Carbs',       val: totals.carbs,   max: 250, unit: 'g', color: 'var(--accent-amber)',  Icon: Wheat },
          { label: 'Fat',         val: totals.fat,     max: 65,  unit: 'g', color: 'var(--accent-teal)',   Icon: Droplets },
        ].map(({ label, val, max, unit, color, Icon }) => (
          <div key={label} className="macro-row">
            <div className="macro-row-header">
              <span className="macro-name flex-gap-sm"><Icon size={13} color={color} /> {label}</span>
              <span className="macro-val" style={{ color }}>{Math.round(val)}g <span style={{ color:'var(--text-muted)', fontWeight:400 }}>/ {max}{unit}</span></span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width:`${Math.min(val/max,1)*100}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Steps Chart */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="section-label" style={{ display:'flex', alignItems:'center', gap:6 }}>
          <TrendingUp size={12} /> Weekly Steps
        </div>
        <div className="bar-chart">
          {barData.map((val, i) => (
            <div key={i} className="bar-col">
              <div className="bar-fill" style={{
                height: `${(val / maxSteps) * 60}px`,
                background: `linear-gradient(to top, var(--accent-green), rgba(34,197,94,0.4))`,
              }} />
              <span className="bar-day">{days[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid-2" style={{ marginBottom: 12 }}>
        <button className="card btn-ghost" onClick={() => navigate('/steps')} id="quick-steps"
          style={{ padding: 16, cursor:'pointer', border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8, alignItems:'flex-start' }}>
          <Footprints size={20} color="var(--accent-green)" />
          <div>
            <div style={{ fontWeight: 700, fontSize:'0.9rem', color:'var(--text-primary)' }}>Track Steps</div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Live counter</div>
          </div>
        </button>
        <button className="card btn-ghost" onClick={() => navigate('/food')} id="quick-food"
          style={{ padding: 16, cursor:'pointer', border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8, alignItems:'flex-start' }}>
          <Flame size={20} color="var(--accent-amber)" />
          <div>
            <div style={{ fontWeight: 700, fontSize:'0.9rem', color:'var(--text-primary)' }}>Log Food</div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{meals.length} meals today</div>
          </div>
        </button>
      </div>

      {/* Recent meals preview */}
      {meals.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div className="flex-between" style={{ marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Recent Meals</div>
            <button onClick={() => navigate('/food')} style={{ background:'none', border:'none', color:'var(--accent-green)', cursor:'pointer', display:'flex', alignItems:'center', gap:2, fontSize:'0.78rem', fontWeight:600 }}>
              See all <ChevronRight size={14} />
            </button>
          </div>
          {meals.slice(-3).reverse().map(m => (
            <div key={m.id} className="meal-item">
              <span className="meal-icon">{m.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="meal-name" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
                <div className="meal-macros">P {Math.round(m.protein)}g · C {Math.round(m.carbs)}g · F {Math.round(m.fat)}g</div>
              </div>
              <div className="meal-kcal">{Math.round(m.calories)} kcal</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
