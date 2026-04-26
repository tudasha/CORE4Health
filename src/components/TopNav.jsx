import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Footprints, UtensilsCrossed, Heart } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/',       label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/steps',  label: 'Steps',     Icon: Footprints },
  { path: '/food',   label: 'Food Log',  Icon: UtensilsCrossed },
];

export default function TopNav() {
  const navigate  = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="top-nav">
      {/* Logo */}
      <div className="top-nav-logo">
        <Heart size={18} color="var(--accent-green)" fill="rgba(34,197,94,0.25)" />
        <span>Core4Health</span>
      </div>

      {/* Tabs */}
      <div className="top-nav-tabs">
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const active = pathname === path;
          return (
            <button
              key={path}
              className={`top-nav-item${active ? ' active' : ''}`}
              onClick={() => navigate(path)}
              id={`nav-${label.toLowerCase().replace(' ', '-')}`}
            >
              <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
              <span className="top-nav-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
