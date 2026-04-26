import { useState, useCallback } from 'react';
import { API } from '../context/AuthContext';

function getToken() { return localStorage.getItem('c4h_token'); }
const authHeader = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

export function useHealth() {
  const [meals, setMeals]             = useState([]);
  const [stepHistory, setStepHistory] = useState([]);
  const [todaySteps, setTodaySteps]   = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  // ── Meals ────────────────────────────────────────────────────

  const fetchMeals = useCallback(async (date) => {
    const params = date ? `?date=${date}` : '';
    try {
      const res  = await fetch(`${API}/api/health/meals${params}`, { headers: authHeader() });
      if (!res.ok) { setError(`Server error ${res.status} — have you deployed the updated backend?`); return; }
      const data = await res.json();
      if (data.success) setMeals(data.meals);
    } catch (e) {
      setError('Cannot reach server. Make sure the backend is running.');
    }
  }, []);

  const addMeal = useCallback(async (meal) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/api/health/meals`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(meal),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error || `Server error ${res.status}`;
        setError(msg);
        return { success: false, error: msg };
      }
      const data = await res.json();
      if (data.success) {
        setMeals(prev => [...prev, data.meal]);
        return { success: true };
      }
      setError(data.error || 'Failed to save meal');
      return { success: false, error: data.error };
    } catch (e) {
      const msg = 'Network error — cannot reach server';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteMeal = useCallback(async (id) => {
    try {
      const res = await fetch(`${API}/api/health/meals/${id}`, { method: 'DELETE', headers: authHeader() });
      if (res.ok) setMeals(prev => prev.filter(m => m.id !== id));
    } catch {}
  }, []);

  // ── Steps ────────────────────────────────────────────────────

  const fetchStepHistory = useCallback(async (days = 7) => {
    try {
      const res  = await fetch(`${API}/api/health/steps?days=${days}`, { headers: authHeader() });
      if (!res.ok) { setError(`Server error ${res.status} — have you deployed the updated backend?`); return; }
      const data = await res.json();
      if (data.success) {
        setStepHistory(data.history);
        // Derive today's total from the last history entry
        if (data.history.length > 0) {
          const last = data.history[data.history.length - 1];
          const today = new Date().toISOString().split('T')[0];
          const lastDay = new Date(last.day).toISOString().split('T')[0];
          if (lastDay === today) setTodaySteps(Number(last.steps) || 0);
        }
      }
    } catch {
      setError('Cannot reach server. Make sure the backend is running.');
    }
  }, []);

  const syncSteps = useCallback(async (steps, goal = 10000) => {
    setError(null);
    try {
      const res = await fetch(`${API}/api/health/steps`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ steps, goal }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error || `Server error ${res.status}`;
        setError(msg);
        return { success: false, error: msg };
      }
      const data = await res.json();
      if (data.success) {
        setTodaySteps(steps);           // optimistic update
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (e) {
      const msg = 'Network error — cannot reach server';
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  // ── Food search (proxied through backend) ────────────────────

  const searchFood = useCallback(async (query) => {
    if (!query.trim()) return { foods: [], error: null };
    try {
      const res  = await fetch(`${API}/api/food/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        return { foods: [], error: data.error || `Server error ${res.status}` };
      }
      // FatSecret returns single object or array — normalise
      const raw = data?.foods?.food;
      if (!raw) return { foods: [], error: null };
      return { foods: Array.isArray(raw) ? raw : [raw], error: null };
    } catch {
      return { foods: [], error: 'Network error searching food' };
    }
  }, []);

  const getFoodDetails = useCallback(async (foodId) => {
    try {
      const res  = await fetch(`${API}/api/food/${foodId}`);
      const data = await res.json();
      if (!res.ok) return null;
      return data?.food || null;
    } catch { return null; }
  }, []);

  // ── AI & Barcode (Core4Health new endpoints) ─────────────────

  const estimateWithAI = useCallback(async (text, imageBase64) => {
    setError(null);
    try {
      const res = await fetch(`${API}/api/food/ai-estimate`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ text, imageBase64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || `Server error ${res.status}` };
      }
      return { success: true, estimation: data.estimation };
    } catch (err) {
      return { success: false, error: 'Network error estimating macros' };
    }
  }, []);

  const searchBarcode = useCallback(async (barcode) => {
    setError(null);
    try {
      const res = await fetch(`${API}/api/food/barcode/${barcode}`, { headers: authHeader() });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || `Server error ${res.status}` };
      }
      return { success: true, food: data.food };
    } catch (err) {
      return { success: false, error: 'Network error searching barcode' };
    }
  }, []);

  // ── Computed totals ──────────────────────────────────────────

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (parseFloat(m.calories) || 0),
      protein:  acc.protein  + (parseFloat(m.protein)  || 0),
      carbs:    acc.carbs    + (parseFloat(m.carbs)     || 0),
      fat:      acc.fat      + (parseFloat(m.fat)       || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    meals, stepHistory, todaySteps, loading, error, totals,
    fetchMeals, addMeal, deleteMeal,
    fetchStepHistory, syncSteps,
    searchFood, getFoodDetails, estimateWithAI, searchBarcode,
    clearError: () => setError(null),
  };
}
