import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/dashboard',     icon: '⚡', label: 'Overview'      },
  { to: '/timeline',      icon: '📈', label: 'Timeline'      },
  { to: '/collaboration', icon: '🤝', label: 'Collaboration' },
  { to: '/forecast',      icon: '🔭', label: 'Forecast'      },
  { to: '/scenarios',     icon: '🎛️', label: 'Scenarios'     },
  { to: '/comparison',    icon: '⚖️', label: 'Comparison'    },
];

export default function App() {
  return (
    <div className="layout">
      {/* Top header */}
      <header className="gn-header">
        <div>
          <div className="gn-logo">KINETIC<span>KIN</span></div>
          <div className="gn-tagline">Decentralized Energy Intelligence · Neighborhood Microgrid OS</div>
        </div>
        <div className="gn-status-pill">
          <div className="gn-status-dot" />
          LIVE · SIMULATION ACTIVE
        </div>
      </header>

      {/* Sidebar + page content */}
      <div className="layout-body">
        <nav className="sidebar">
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
    </div>
  );
}
