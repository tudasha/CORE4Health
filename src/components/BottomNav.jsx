import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Footprints, UtensilsCrossed } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/',       label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/steps',  label: 'Steps',     Icon: Footprints },
  { path: '/food',   label: 'Food Log',  Icon: UtensilsCrossed },
];

export default function BottomNav() {
  const navigate  = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ path, label, Icon }) => {
        const active = pathname === path;
        return (
          <button
            key={path}
            className={`nav-item${active ? ' active' : ''}`}
            onClick={() => navigate(path)}
            id={`nav-${label.toLowerCase().replace(' ', '-')}`}
          >
            <span className="nav-item-icon">
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            </span>
            <span className="nav-item-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
