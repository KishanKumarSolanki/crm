import { NavLink } from "react-router-dom";

const menuItems = [
  {
    name: "Dashboard",
    path: "/",
    icon: "⌂",
  },
  {
    name: "Clients",
    path: "/clients",
    icon: "◉",
  },
  {
    name: "Pipeline",
    path: "/pipeline",
    icon: "▣",
  },
  {
    name: "Tasks",
    path: "/tasks",
    icon: "✓",
  },
  {
    name: "Team Members",
    path: "/team-members",
    icon: "♙",
  },
];

function Sidebar() {
  return (
    <aside className="crm-sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">C</div>

        <div className="logo-text">
          <h2>CRM</h2>
          <span>Management System</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-section">
        <p className="sidebar-title">MAIN MENU</p>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-icon">{item.icon}</span>

              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom User Area */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="user-avatar">A</div>

          <div className="user-info">
            <strong>Admin</strong>
            <span>Administrator</span>
          </div>
        </div>
      </div>

      <style>{`
        .crm-sidebar {
          width: 250px;
          min-width: 250px;
          height: 100vh;
          position: fixed;
          left: 0;
          top: 0;
          z-index: 1000;

          display: flex;
          flex-direction: column;

          background: #ffffff;
          border-right: 1px solid #e5e7eb;

          padding: 22px 14px;
          box-sizing: border-box;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 11px;

          padding: 4px 8px 24px;
          border-bottom: 1px solid #f0f1f3;
        }

        .logo-mark {
          width: 40px;
          height: 40px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 11px;

          background: #111827;
          color: #ffffff;

          font-size: 19px;
          font-weight: 700;
        }

        .logo-text h2 {
          margin: 0;

          color: #111827;
          font-size: 17px;
          font-weight: 700;
          line-height: 1.2;
        }

        .logo-text span {
          display: block;
          margin-top: 3px;

          color: #9ca3af;
          font-size: 10px;
          line-height: 1.2;
        }

        .sidebar-section {
          margin-top: 27px;
        }

        .sidebar-title {
          margin: 0 10px 10px;

          color: #9ca3af;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 12px;

          min-height: 43px;
          padding: 0 12px;

          border-radius: 9px;

          color: #6b7280;
          text-decoration: none;

          font-size: 13px;
          font-weight: 500;

          transition:
            background 0.2s ease,
            color 0.2s ease;
        }

        .sidebar-link:hover {
          background: #f5f6f8;
          color: #111827;
        }

        .sidebar-link.active {
          background: #111827;
          color: #ffffff;
        }

        .sidebar-icon {
          width: 20px;
          height: 20px;

          display: flex;
          align-items: center;
          justify-content: center;

          font-size: 16px;
          flex-shrink: 0;
        }

        .sidebar-bottom {
          margin-top: auto;
          padding: 14px 6px 4px;

          border-top: 1px solid #f0f1f3;
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;

          padding: 8px;
        }

        .user-avatar {
          width: 34px;
          height: 34px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #f1f5f9;
          color: #111827;

          font-size: 13px;
          font-weight: 700;
        }

        .user-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .user-info strong {
          color: #111827;
          font-size: 12px;
          font-weight: 600;
        }

        .user-info span {
          margin-top: 2px;

          color: #9ca3af;
          font-size: 10px;
        }

        @media (max-width: 768px) {
          .crm-sidebar {
            width: 70px;
            min-width: 70px;
            padding: 16px 9px;
          }

          .sidebar-logo {
            justify-content: center;
            padding: 4px 0 20px;
          }

          .logo-text,
          .sidebar-title,
          .sidebar-link > span:not(.sidebar-icon),
          .user-info {
            display: none;
          }

          .sidebar-link {
            justify-content: center;
            padding: 0;
          }

          .sidebar-icon {
            width: 24px;
          }

          .sidebar-user {
            justify-content: center;
            padding: 8px 0;
          }
        }
      `}</style>
    </aside>
  );
}

export default Sidebar;