import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Heart, Mail, Lock, User, ArrowRight, Loader } from 'lucide-react';

function Field({ id, type, placeholder, value, onChange, Icon }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
        <Icon size={16} />
      </span>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="input"
        style={{ paddingLeft: 40 }}
        autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'name'}
      />
    </div>
  );
}

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    const result = isRegister
      ? await register(name, email, password)
      : await login(email, password);
    setLoading(false);
    if (result.success) navigate('/');
    else setErr(result.error);
  }

  return (
    <div className="auth-page">
      {/* Logo */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 12, marginBottom: 40 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: 'linear-gradient(135deg, #22c55e22, #22c55e44)',
          border: '1.5px solid rgba(34,197,94,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Heart size={32} color="var(--accent-green)" fill="rgba(34,197,94,0.2)" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Core4Health</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Your personal health companion</div>
        </div>
      </div>

      {/* Card */}
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
          {isRegister ? 'Create account' : 'Welcome back'}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isRegister && (
            <Field id="reg-name" type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} Icon={User} />
          )}
          <Field id="auth-email" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} Icon={Mail} />
          <Field id="auth-password" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} Icon={Lock} />

          {err && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', fontSize: '0.82rem', color: 'var(--accent-rose)' }}>
              {err}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} id="auth-submit" style={{ marginTop: 4 }}>
            {loading ? <Loader size={18} className="spinner" style={{ border: 'none', width: 18, height: 18 }} /> : (
              <>{isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={18} /></>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setErr(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-green)', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit', fontSize: '0.85rem' }}
            id="auth-toggle"
          >
            {isRegister ? 'Sign in' : 'Register'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Uses the same account as SmartHub
      </div>
    </div>
  );
}
