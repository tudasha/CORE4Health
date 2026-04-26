import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('c4h_token');
    if (token) {
      fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (data.user) setUser(data.user); else localStorage.removeItem('c4h_token'); })
        .catch(() => localStorage.removeItem('c4h_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) { localStorage.setItem('c4h_token', data.token); setUser(data.user); return { success: true }; }
      return { success: false, error: data.error || 'Login failed' };
    } catch (err) { return { success: false, error: 'Cannot reach server: ' + err.message }; }
  };

  const register = async (name, email, password) => {
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) { localStorage.setItem('c4h_token', data.token); setUser(data.user); return { success: true }; }
      return { success: false, error: data.error || 'Registration failed' };
    } catch (err) { return { success: false, error: 'Cannot reach server: ' + err.message }; }
  };

  const logout = () => { localStorage.removeItem('c4h_token'); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { API };
