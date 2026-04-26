import { useState, useEffect } from 'react';
import { Footprints, Play, Pause, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { useHealth } from '../hooks/useHealth';
import { useSteps } from '../context/StepContext';

const STEP_GOAL = 10000;

// ── Toast helper ──────────────────────────────────────────────
function Toast({ message, type = 'success', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="toast" style={{
      borderColor: type === 'success' ? 'rgba(34,197,94,0.4)' : 'rgba(244,63,94,0.4)',
      color: type === 'success' ? 'var(--accent-green)' : 'var(--accent-rose)',
    }}>
      {type === 'success' ? <CheckCircle size={14} style={{ display:'inline', marginRight:6 }} /> : <AlertCircle size={14} style={{ display:'inline', marginRight:6 }} />}
      {message}
    </div>
  );
}

export default function StepCounter() {
  const [manualInput, setManualInput] = useState('');
  const [toast, setToast]         = useState(null);
  
  const { stepHistory, fetchStepHistory, error } = useHealth();
  const { totalToday, active, setActive, addSteps } = useSteps();

  useEffect(() => { fetchStepHistory(7); }, []);

  // Show server errors as toast
  useEffect(() => {
    if (error) setToast({ message: error, type: 'error' });
  }, [error]);

  // "Add" button: adds manual steps
  const handleAddManual = () => {
    const n = parseInt(manualInput);
    if (isNaN(n) || n <= 0) return;
    addSteps(n);
    setManualInput('');
    setToast({ message: `✓ ${n.toLocaleString()} steps added`, type: 'success' });
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleAddManual(); };

  const pct  = Math.min(totalToday / STEP_GOAL, 1);
  const size = 200;
  const sw   = 15;
  const r    = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  const days    = ['M','T','W','T','F','S','S'];
  const maxH    = Math.max(...stepHistory.map(h => Number(h.steps) || 0), 1);
  const barData = Array.from({ length: 7 }, (_, i) => {
    const entry = stepHistory[stepHistory.length - 7 + i];
    return entry ? Number(entry.steps) : 0;
  });

  return (
    <div className="page">
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <div className="page-header">
        <div className="page-title">Step Counter</div>
        <div className="page-subtitle">
          Background counting is {active ? 'active' : 'paused'}
        </div>
      </div>

      {/* Big ring */}
      <div className="card" style={{ padding: 24, marginBottom: 12, display:'flex', flexDirection:'column', alignItems:'center', gap: 20 }}>
        <div style={{ position: 'relative' }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={sw} />
            <circle
              cx={size/2} cy={size/2} r={r} fill="none"
              stroke={pct >= 1 ? 'var(--accent-teal)' : 'var(--accent-green)'}
              strokeWidth={sw}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.4s ease' }}
            />
          </svg>
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap: 2 }}>
            <div style={{ fontSize: '2.6rem', fontWeight: 900, color: pct >= 1 ? 'var(--accent-teal)' : 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.04em' }}>
              {totalToday.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>of {STEP_GOAL.toLocaleString()}</div>
            <div style={{ marginTop: 4 }}>
              {pct >= 1
                ? <span className="pill pill-green">🎉 Goal reached!</span>
                : <span className="pill pill-purple">{Math.round(pct * 100)}% done</span>}
            </div>
            {active && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop: 4 }}>
                <div className="live-dot" />
                <span style={{ fontSize:'0.72rem', color:'var(--accent-green)', fontWeight:600 }}>Counting…</span>
              </div>
            )}
          </div>
        </div>

        {/* Accel controls */}
        <div style={{ display:'flex', gap: 10, width:'100%' }}>
          <button
            className={`btn ${active ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => setActive(a => !a)}
            id="btn-toggle-steps"
            style={{ flex:1 }}
          >
            {active ? <><Pause size={18}/> Pause Tracker</> : <><Play size={18}/> Resume Tracker</>}
          </button>
        </div>
      </div>

      {/* ── Manual entry ── */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="section-label">Add steps manually</div>
        <div style={{ display:'flex', gap:10 }}>
          <input
            id="manual-steps-input"
            type="number"
            className="input"
            placeholder="e.g. 3500"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={handleKeyDown}
            inputMode="numeric"
          />
          <button
            className="btn btn-primary"
            onClick={handleAddManual}
            disabled={!manualInput}
            id="btn-add-manual"
            style={{ width:'auto', padding:'0 16px', flexShrink:0 }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid-3" style={{ marginBottom: 12 }}>
        {[
          { label: 'Steps Left',  value: Math.max(STEP_GOAL - totalToday, 0).toLocaleString(), color: 'var(--accent-purple)' },
          { label: 'kcal Burned', value: Math.round(totalToday * 0.04),                         color: 'var(--accent-amber)' },
          { label: 'Km Walked',   value: (totalToday * 0.00078).toFixed(2),                      color: 'var(--accent-teal)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-chip">
            <div className="stat-chip-value" style={{ color }}>{value}</div>
            <div className="stat-chip-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Weekly chart */}
      <div className="card" style={{ padding: 16 }}>
        <div className="section-label"><TrendingUp size={12} style={{ display:'inline', marginRight:4 }}/>7-Day History</div>
        {stepHistory.length === 0
          ? <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-muted)', fontSize:'0.82rem' }}>
              No history yet — add some steps to get started!
            </div>
          : <div className="bar-chart">
              {barData.map((val, i) => (
                <div key={i} className="bar-col">
                  <div className="bar-fill" style={{
                    height: `${(val / maxH) * 60}px`,
                    background: val >= STEP_GOAL
                      ? 'linear-gradient(to top, var(--accent-teal), rgba(20,184,166,0.3))'
                      : 'linear-gradient(to top, var(--accent-green), rgba(34,197,94,0.3))',
                  }}/>
                  <span className="bar-day">{days[i]}</span>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
