import { useState, useCallback } from 'react';
import { API } from '../context/AuthContext';

function getToken() { return localStorage.getItem('c4h_token'); }
const authHeader = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

export function useHealth() {
  const [meals, setMeals]       = useState([]);
  const [stepHistory, setStepHistory] = useState([]);
  const [loading, setLoading]   = useState(false);

  // ── Meals ──────────────────────────────────────────────────

  const fetchMeals = useCallback(async (date) => {
    const params = date ? `?date=${date}` : '';
    try {
      const res = await fetch(`${API}/api/health/meals${params}`, { headers: authHeader() });
      const data = await res.json();
      if (data.success) setMeals(data.meals);
    } catch {}
  }, []);

  const addMeal = useCallback(async (meal) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/health/meals`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(meal),
      });
      const data = await res.json();
      if (data.success) { setMeals(prev => [...prev, data.meal]); return { success: true }; }
      return { success: false, error: data.error };
    } catch { return { success: false, error: 'Network error' }; }
    finally { setLoading(false); }
  }, []);

  const deleteMeal = useCallback(async (id) => {
    try {
      await fetch(`${API}/api/health/meals/${id}`, { method: 'DELETE', headers: authHeader() });
      setMeals(prev => prev.filter(m => m.id !== id));
    } catch {}
  }, []);

  // ── Steps ──────────────────────────────────────────────────

  const fetchStepHistory = useCallback(async (days = 7) => {
    try {
      const res = await fetch(`${API}/api/health/steps?days=${days}`, { headers: authHeader() });
      const data = await res.json();
      if (data.success) setStepHistory(data.history);
    } catch {}
  }, []);

  const syncSteps = useCallback(async (steps, goal = 10000) => {
    try {
      await fetch(`${API}/api/health/steps`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ steps, goal }),
      });
    } catch {}
  }, []);

  // ── Food search (proxied through backend) ──────────────────

  const searchFood = useCallback(async (query) => {
    if (!query.trim()) return [];
    try {
      const res = await fetch(`${API}/api/food/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      return data?.foods?.food || [];
    } catch { return []; }
  }, []);

  const getFoodDetails = useCallback(async (foodId) => {
    try {
      const res = await fetch(`${API}/api/food/${foodId}`);
      const data = await res.json();
      return data?.food || null;
    } catch { return null; }
  }, []);

  // ── Computed totals ─────────────────────────────────────────

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
    meals, stepHistory, loading, totals,
    fetchMeals, addMeal, deleteMeal,
    fetchStepHistory, syncSteps,
    searchFood, getFoodDetails,
  };
}
