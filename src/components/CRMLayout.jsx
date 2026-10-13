import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Sidebar from "./Sidebar";

function CRMLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [userEmail, setUserEmail] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setUserEmail(user.email || "");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getPageTitle = () => {
    const path = location.pathname;

    if (path === "/") return "Dashboard";
    if (path === "/clients") return "Clients";
    if (path === "/pipeline") return "Pipeline";
    if (path === "/tasks") return "Tasks";
    if (path === "/team-members") return "Team Members";

    if (path.startsWith("/client/")) return "Client Details";
    if (path.startsWith("/team-member/")) return "Team Member";

    return "CRM";
  };

  return (
    <div className="crm-layout">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Area */}
      <div className="crm-main">
        {/* Header */}
        <header className="crm-header">
          <div className="header-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              ☰
            </button>

            <div>
              <h1>{getPageTitle()}</h1>
              <p>Manage your business from one place</p>
            </div>
          </div>

          <div className="header-right">
            {/* Search */}
            <div className="header-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search..."
                onChange={() => {}}
              />
            </div>

            {/* Notification */}
            <button className="header-icon-btn" title="Notifications">
              ♧
              <span className="notification-dot"></span>
            </button>

            {/* User */}
            <div className="header-user">
              <div className="header-avatar">A</div>

              <div className="header-user-info">
                <strong>Admin</strong>
                <span>{userEmail || "Administrator"}</span>
              </div>

              <button
                className="logout-btn"
                onClick={handleLogout}
                title="Logout"
              >
                ↪
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="crm-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile Overlay */}
      {mobileMenu && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenu(false)}
        ></div>
      )}

      <style>{`
        * {
          box-sizing: border-box;
        }

        .crm-layout {
          min-height: 100vh;
          background: #f7f8fa;
        }

        .crm-main {
          min-height: 100vh;
          margin-left: 250px;
        }

        .crm-header {
          height: 76px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 0 30px;

          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;

          position: sticky;
          top: 0;
          z-index: 900;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-left h1 {
          margin: 0;

          color: #111827;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.2;
        }

        .header-left p {
          margin: 4px 0 0;

          color: #9ca3af;
          font-size: 11px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-search {
          width: 190px;
          height: 38px;

          display: flex;
          align-items: center;
          gap: 7px;

          padding: 0 11px;

          background: #f8f9fb;
          border: 1px solid #eceef1;
          border-radius: 8px;
        }

        .header-search span {
          color: #9ca3af;
          font-size: 18px;
        }

        .header-search input {
          width: 100%;

          border: none;
          outline: none;
          background: transparent;

          color: #374151;
          font-size: 12px;
        }

        .header-search input::placeholder {
          color: #a1a1aa;
        }

        .header-icon-btn {
          width: 38px;
          height: 38px;

          position: relative;

          border: 1px solid #eceef1;
          border-radius: 8px;

          background: #ffffff;
          color: #6b7280;

          cursor: pointer;

          font-size: 17px;
        }

        .header-icon-btn:hover {
          background: #f8f9fb;
        }

        .notification-dot {
          position: absolute;
          top: 8px;
          right: 8px;

          width: 5px;
          height: 5px;

          border-radius: 50%;
          background: #ef4444;
        }

        .header-user {
          display: flex;
          align-items: center;
          gap: 9px;

          padding-left: 8px;
          border-left: 1px solid #e5e7eb;
        }

        .header-avatar {
          width: 34px;
          height: 34px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #111827;
          color: #ffffff;

          font-size: 12px;
          font-weight: 700;
        }

        .header-user-info {
          display: flex;
          flex-direction: column;

          max-width: 150px;
        }

        .header-user-info strong {
          color: #111827;
          font-size: 11px;
          font-weight: 600;
        }

        .header-user-info span {
          margin-top: 2px;

          color: #9ca3af;
          font-size: 9px;

          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .logout-btn {
          width: 32px;
          height: 32px;

          border: none;
          border-radius: 7px;

          background: transparent;
          color: #9ca3af;

          cursor: pointer;

          font-size: 18px;
        }

        .logout-btn:hover {
          background: #fef2f2;
          color: #dc2626;
        }

        .crm-content {
          padding: 28px 30px 40px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .mobile-menu-btn {
          display: none;

          width: 36px;
          height: 36px;

          border: 1px solid #e5e7eb;
          border-radius: 8px;

          background: #ffffff;
          color: #374151;

          cursor: pointer;
        }

        .mobile-overlay {
          display: none;
        }

        @media (max-width: 1000px) {
          .header-search {
            display: none;
          }

          .header-user-info {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .crm-main {
            margin-left: 70px;
          }

          .crm-header {
            height: 68px;
            padding: 0 16px;
          }

          .mobile-menu-btn {
            display: block;
          }

          .header-left h1 {
            font-size: 17px;
          }

          .header-left p {
            display: none;
          }

          .crm-content {
            padding: 20px 16px 30px;
          }

          .header-right {
            gap: 7px;
          }

          .header-user {
            border-left: none;
            padding-left: 0;
          }
        }

        @media (max-width: 480px) {
          .crm-header {
            padding: 0 12px;
          }

          .crm-content {
            padding: 16px 12px 25px;
          }

          .header-icon-btn {
            width: 34px;
            height: 34px;
          }

          .header-avatar {
            width: 32px;
            height: 32px;
          }

          .logout-btn {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export default CRMLayout;