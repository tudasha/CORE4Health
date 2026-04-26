import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Motion } from '@capacitor/motion';
import { useHealth } from '../hooks/useHealth';

const StepContext = createContext();

export function StepProvider({ children }) {
  const { todaySteps: serverSteps, syncSteps, fetchStepHistory } = useHealth();
  
  const [active, setActive] = useState(true); // Always on by default
  const [unsyncedSteps, setUnsyncedSteps] = useState(0);
  
  const lastAcc = useRef({ x: 0, y: 0, z: 0 });
  const lastPeak = useRef(false);
  const threshold = 1.5;
  const unsyncedRef = useRef(0);
  const syncTimeoutRef = useRef(null);

  // Load unsynced steps from localStorage on mount (in case app closed before sync)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem('c4h_unsynced_steps');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) {
          setUnsyncedSteps(parsed.steps);
          unsyncedRef.current = parsed.steps;
        } else {
          localStorage.removeItem('c4h_unsynced_steps');
        }
      } catch (e) {}
    }
    // Initial fetch of server steps
    fetchStepHistory(7);
  }, []);

  // Sync function that pushes only the delta (unsynced steps)
  const pushStepsToServer = useCallback(async () => {
    const stepsToSync = unsyncedRef.current;
    if (stepsToSync <= 0) return;

    // Reset unsynced immediately to prevent double counting if steps happen during network request
    unsyncedRef.current = 0;
    setUnsyncedSteps(0);
    localStorage.removeItem('c4h_unsynced_steps');

    const res = await syncSteps(stepsToSync, 10000);
    if (!res.success) {
      // If failed, add back the steps to unsynced
      unsyncedRef.current += stepsToSync;
      setUnsyncedSteps(unsyncedRef.current);
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('c4h_unsynced_steps', JSON.stringify({ date: today, steps: unsyncedRef.current }));
    } else {
      // Fetch latest history to update serverSteps
      fetchStepHistory(7);
    }
  }, [syncSteps, fetchStepHistory]);

  // Debounced auto-sync (e.g., 10 seconds after the last step, or every X steps)
  const triggerAutoSync = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      pushStepsToServer();
    }, 10000); // Wait 10s of inactivity before syncing
  }, [pushStepsToServer]);

  const addSteps = useCallback((count) => {
    if (count <= 0) return;
    unsyncedRef.current += count;
    setUnsyncedSteps(unsyncedRef.current);
    
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('c4h_unsynced_steps', JSON.stringify({ date: today, steps: unsyncedRef.current }));
    
    // Auto sync instantly on every step for 10ms-like live feeling
    if (unsyncedRef.current >= 1) {
      pushStepsToServer();
    } else {
      triggerAutoSync();
    }
  }, [pushStepsToServer, triggerAutoSync]);

  // Accelerometer Listener
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
            addSteps(1);
          } else if (mag < threshold * 0.4) {
            lastPeak.current = false;
          }
          lastAcc.current = { x, y, z };
        });
      } catch {
        console.warn('[StepCounter] Motion API unavailable');
      }
    })();
    return () => { handler?.remove?.(); };
  }, [active, addSteps]);

  // Total steps for the day = server confirmed + locally unsynced
  const totalToday = (serverSteps || 0) + unsyncedSteps;

  return (
    <StepContext.Provider value={{ 
      totalToday,
      serverSteps,
      unsyncedSteps,
      addSteps,
      active,
      setActive,
      forceSync: pushStepsToServer
    }}>
      {children}
    </StepContext.Provider>
  );
}

export const useSteps = () => useContext(StepContext);
