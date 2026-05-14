import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/dashboard', icon: '⚡', label: 'Overview' },
  { to: '/timeline', icon: '📈', label: 'Timeline' },
  { to: '/collaboration', icon: '🤝', label: 'Collaboration' },
  { to: '/forecast', icon: '🔭', label: 'Forecast' },
  { to: '/scenarios', icon: '🎛️', label: 'Scenarios' },
  { to: '/comparison', icon: '⚖️', label: 'Comparison' },
];

export default function App() {
  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-logo">Grid<span>Mind</span></div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
