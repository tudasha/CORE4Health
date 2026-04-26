import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import TopNav from './components/TopNav';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StepCounter from './pages/StepCounter';
import FoodLog from './pages/FoodLog';
import { Loader } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-primary)' }}>
      <div className="spinner" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppLayout() {
  return (
    <>
      <TopNav />
      <Routes>
        <Route path="/"      element={<Dashboard />} />
        <Route path="/steps" element={<StepCounter />} />
        <Route path="/food"  element={<FoodLog />} />
        <Route path="*"      element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
