import { useState, useEffect, useRef, useCallback } from 'react';
import { Motion } from '@capacitor/motion';
import { Footprints, Play, Pause, RotateCcw, TrendingUp, Target, Save } from 'lucide-react';
import { useHealth } from '../hooks/useHealth';

const STEP_GOAL = 10000;

// Accelerometer-based step detection
function useStepDetector(active) {
  const [steps, setSteps]   = useState(0);
  const lastAcc = useRef({ x: 0, y: 0, z: 0 });
  const lastPeak= useRef(false);
  const threshold = 1.5; // m/s² delta to count a step

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
            setSteps(s => s + 1);
          } else if (mag < threshold * 0.4) {
            lastPeak.current = false;
          }
          lastAcc.current = { x, y, z };
        });
      } catch {
        // Motion API not available (browser/emulator fallback — use manual input)
        console.warn('[StepCounter] Motion API not available, manual mode only');
      }
    })();
    return () => { handler?.remove?.(); };
  }, [active]);

  return { steps, setSteps };
}

export default function StepCounter() {
  const [active, setActive] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [saved, setSaved]   = useState(false);
  const { steps, setSteps } = useStepDetector(active);
  const { stepHistory, fetchStepHistory, syncSteps } = useHealth();

  // Also track manual total
  const [totalSteps, setTotalSteps] = useState(0);
  const allSteps = totalSteps + steps;

  useEffect(() => { fetchStepHistory(7); }, []);

  const reset = () => { setTotalSteps(0); setSteps(0); setSaved(false); };

  const addManual = () => {
    const n = parseInt(manualInput);
    if (!isNaN(n) && n > 0) { setTotalSteps(s => s + n); setManualInput(''); }
  };

  const save = async () => {
    await syncSteps(allSteps, STEP_GOAL);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const pct = Math.min(allSteps / STEP_GOAL, 1);
  const size = 220;
  const sw   = 16;
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
      <div className="page-header">
        <div className="page-title">Step Counter</div>
        <div className="page-subtitle">Accelerometer-based · syncs to server</div>
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
              style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.4s' }}
            />
          </svg>
          <div style={{
            position:'absolute', inset:0, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', gap: 2,
          }}>
            <div style={{ fontSize: '2.8rem', fontWeight: 900, color: pct >= 1 ? 'var(--accent-teal)' : 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.04em' }}>
              {allSteps.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>of {STEP_GOAL.toLocaleString()} steps</div>
            <div style={{ marginTop: 4 }}>
              {pct >= 1
                ? <span className="pill pill-green">🎉 Goal reached!</span>
                : <span className="pill pill-purple">{Math.round(pct * 100)}% done</span>
              }
            </div>
            {active && (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginTop: 6 }}>
                <div className="live-dot" />
                <span style={{ fontSize:'0.72rem', color:'var(--accent-green)', fontWeight:600 }}>Counting…</span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display:'flex', gap: 12, width:'100%' }}>
          <button
            className={`btn ${active ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => setActive(a => !a)}
            id="btn-toggle-steps"
            style={{ flex:1 }}
          >
            {active ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start</>}
          </button>
          <button className="btn btn-ghost btn-icon" onClick={reset} id="btn-reset-steps">
            <RotateCcw size={16} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={save} id="btn-save-steps"
            style={{ borderColor: saved ? 'var(--accent-green)' : undefined, color: saved ? 'var(--accent-green)' : undefined }}>
            <Save size={16} />
          </button>
        </div>
        {saved && <div className="pill pill-green" style={{ fontSize:'0.8rem' }}>✓ Synced to server</div>}
      </div>

      {/* Manual entry */}
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
            inputMode="numeric"
          />
          <button className="btn btn-primary" onClick={addManual} id="btn-add-manual" style={{ width:'auto', padding:'0 20px', flexShrink:0 }}>
            Add
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid-3" style={{ marginBottom: 12 }}>
        {[
          { label: 'Steps Left', value: Math.max(STEP_GOAL - allSteps, 0).toLocaleString(), color: 'var(--accent-purple)' },
          { label: 'kcal Burned', value: Math.round(allSteps * 0.04), color: 'var(--accent-amber)' },
          { label: 'Km Walked', value: (allSteps * 0.00078).toFixed(2), color: 'var(--accent-teal)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-chip">
            <div className="stat-chip-value" style={{ color }}>{value}</div>
            <div className="stat-chip-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Weekly bar chart */}
      <div className="card" style={{ padding: 16 }}>
        <div className="section-label"><TrendingUp size={12} style={{ display:'inline', marginRight:4 }} />7-Day History</div>
        <div className="bar-chart">
          {barData.map((val, i) => (
            <div key={i} className="bar-col">
              <div className="bar-fill" style={{
                height: `${(val / maxH) * 60}px`,
                background: val >= STEP_GOAL
                  ? 'linear-gradient(to top, var(--accent-teal), rgba(20,184,166,0.4))'
                  : 'linear-gradient(to top, var(--accent-green), rgba(34,197,94,0.3))',
              }} />
              <span className="bar-day">{days[i]}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:8, textAlign:'center' }}>Teal bars = goal reached</div>
      </div>
    </div>
  );
}
