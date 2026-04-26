import { useState, useEffect, useRef } from 'react';
import { Motion } from '@capacitor/motion';
import { Footprints, Play, Pause, RotateCcw, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { useHealth } from '../hooks/useHealth';

const STEP_GOAL = 10000;

// ── Accelerometer-based step detection ───────────────────────
function useStepDetector(active) {
  const [accelSteps, setAccelSteps] = useState(0);
  const lastAcc   = useRef({ x: 0, y: 0, z: 0 });
  const lastPeak  = useRef(false);
  const threshold = 1.5;

  useEffect(() => {
    if (!active) return;
    let handler;
    (async () => {
      try {
        handler = await Motion.addListener('accel', ({ acceleration }) => {
          if (!acceleration) return;
          const { x, y, z } = acceleration;
          const dx = x - lastAcc.current.x;
          const dy = y - lastAcc.current.y;
          const dz = z - lastAcc.current.z;
          const mag = Math.sqrt(dx*dx + dy*dy + dz*dz);

          if (mag > threshold && !lastPeak.current) {
            lastPeak.current = true;
            setAccelSteps(s => s + 1);
          } else if (mag < threshold * 0.4) {
            lastPeak.current = false;
          }
          lastAcc.current = { x, y, z };
        });
      } catch {
        console.warn('[StepCounter] Motion API unavailable — use manual input');
      }
    })();
    return () => { handler?.remove?.(); };
  }, [active]);

  return { accelSteps, resetAccel: () => setAccelSteps(0) };
}

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
  const [active, setActive]       = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [manualTotal, setManualTotal] = useState(0);
  const [toast, setToast]         = useState(null); // { message, type }
  const [saving, setSaving]       = useState(false);

  const { accelSteps, resetAccel } = useStepDetector(active);
  const { stepHistory, todaySteps: serverSteps, fetchStepHistory, syncSteps, error } = useHealth();

  const allSteps = manualTotal + accelSteps;

  useEffect(() => { fetchStepHistory(7); }, []);

  // Show server errors as toast
  useEffect(() => {
    if (error) setToast({ message: error, type: 'error' });
  }, [error]);

  const reset = () => {
    setManualTotal(0);
    resetAccel();
    setToast(null);
  };

  // "Add" button: adds manual steps AND saves to server immediately
  const addAndSave = async () => {
    const n = parseInt(manualInput);
    if (isNaN(n) || n <= 0) return;

    const newTotal = manualTotal + accelSteps + n;
    setManualTotal(prev => prev + n);
    setManualInput('');
    setSaving(true);

    const result = await syncSteps(newTotal, STEP_GOAL);
    setSaving(false);

    if (result?.success) {
      setToast({ message: `✓ ${newTotal.toLocaleString()} steps saved to server`, type: 'success' });
      fetchStepHistory(7); // refresh chart
    } else {
      setToast({ message: result?.error || 'Failed to save', type: 'error' });
    }
  };

  // Also save when Enter pressed
  const handleKeyDown = (e) => { if (e.key === 'Enter') addAndSave(); };

  // Manual save button (for accel-counted steps)
  const saveAccel = async () => {
    if (allSteps === 0) return;
    setSaving(true);
    const result = await syncSteps(allSteps, STEP_GOAL);
    setSaving(false);
    if (result?.success) {
      setToast({ message: `✓ ${allSteps.toLocaleString()} steps saved`, type: 'success' });
      fetchStepHistory(7);
    } else {
      setToast({ message: result?.error || 'Failed to save', type: 'error' });
    }
  };

  const pct  = Math.min(allSteps / STEP_GOAL, 1);
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
          {serverSteps > 0
            ? `${serverSteps.toLocaleString()} steps saved today on server`
            : 'Add steps manually or use accelerometer'}
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
              {allSteps.toLocaleString()}
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
            {active ? <><Pause size={18}/> Pause</> : <><Play size={18}/> Start</>}
          </button>
          <button className="btn btn-ghost btn-icon" onClick={reset} id="btn-reset-steps">
            <RotateCcw size={16}/>
          </button>
          {active && (
            <button
              className="btn btn-ghost"
              onClick={saveAccel}
              disabled={saving || allSteps === 0}
              id="btn-save-accel"
              style={{ width:'auto', padding:'0 14px', fontSize:'0.8rem' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* ── Manual entry — saves immediately on Add ── */}
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="section-label">Add steps manually</div>
        <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:10 }}>
          Type a number and tap <strong style={{ color:'var(--accent-green)' }}>Add & Save</strong> — syncs to server right away.
        </div>
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
            onClick={addAndSave}
            disabled={saving || !manualInput}
            id="btn-add-manual"
            style={{ width:'auto', padding:'0 16px', flexShrink:0 }}
          >
            {saving ? 'Saving…' : 'Add & Save'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid-3" style={{ marginBottom: 12 }}>
        {[
          { label: 'Steps Left',  value: Math.max(STEP_GOAL - allSteps, 0).toLocaleString(), color: 'var(--accent-purple)' },
          { label: 'kcal Burned', value: Math.round(allSteps * 0.04),                         color: 'var(--accent-amber)' },
          { label: 'Km Walked',   value: (allSteps * 0.00078).toFixed(2),                      color: 'var(--accent-teal)' },
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
        {stepHistory.length > 0 && (
          <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:8, textAlign:'center' }}>Teal = goal reached</div>
        )}
      </div>
    </div>
  );
}
