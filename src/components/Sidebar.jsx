import { NavLink } from "react-router-dom";
import Icon from "./Icon";

const menuItems = [
  { name: "Dashboard", path: "/", icon: "dashboard", adminOnly: true },
  { name: "Manager Dashboard", path: "/manager-dashboard", icon: "dashboard", managerOnly: true },
  { name: "Leads", path: "/leads", icon: "leads", adminOnly: true, managerAccess: true },
  { name: "Pipeline", path: "/pipeline", icon: "pipeline", adminOnly: true, managerAccess: true },
  { name: "Marketing", path: "/marketing", icon: "marketing", adminOnly: true },
  { name: "Broadcasting", path: "/broadcasting", icon: "broadcast", adminOnly: true },
  { name: "Tasks", path: "/tasks", icon: "tasks", adminOnly: true, managerAccess: true },
  { name: "Team Members", path: "/team-members", icon: "team", adminOnly: true },
];

function Sidebar({ mobileOpen = false, onNavigate = () => {}, userName = "CRM User", role = "" }) {
  const visibleItems = menuItems.filter(
    (item) =>
      (!item.adminOnly || role === "admin" || (item.managerAccess && role === "manager")) &&
      (!item.managerOnly || role === "manager")
  );

  const initials = userName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Labels are shown on mobile drawer, and on desktop (>=769px). Otherwise icon-only.
  const showLabels = mobileOpen;
  const labelClass = showLabels ? "" : "hidden min-[769px]:inline";
  const textBlockClass = showLabels ? "" : "hidden min-[769px]:block";

  return (
    <aside
      id="crm-navigation"
      aria-label="Main navigation"
      className={`crm-sidebar fixed left-0 top-0 z-[1000] flex h-screen flex-col border-r border-slate-200/70 bg-white/90 backdrop-blur-xl transition-[width] duration-300 ease-out ${
        mobileOpen
          ? "w-[260px] min-w-[260px] px-3.5"
          : "w-[70px] min-w-[70px] px-2 min-[769px]:w-[250px] min-[769px]:min-w-[250px] min-[769px]:px-3.5"
      } py-6`}
    >
      {/* Brand */}
      <div
        className={`flex items-center gap-3 px-2 pb-6 ${
          showLabels ? "" : "justify-center min-[769px]:justify-start"
        }`}
      >
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[18px] font-bold text-white shadow-lg shadow-indigo-500/30">
          <span className="relative z-10">C</span>
          <span className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0" />
        </div>
        <div className={textBlockClass}>
          <h2 className="text-[17px] font-bold leading-tight tracking-tight text-slate-900">CRM</h2>
          <span className="mt-0.5 block text-[11px] font-medium leading-tight text-slate-400">
            Management System
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-2 flex-1 overflow-y-auto">
        <p
          className={`mx-3 mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ${
            showLabels ? "" : "hidden min-[769px]:block"
          }`}
        >
          Main Menu
        </p>

        <nav className="flex flex-col gap-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onNavigate}
              title={!mobileOpen ? item.name : undefined}
              className={({ isActive }) =>
                `group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium no-underline transition-all duration-200 ${
                  showLabels ? "" : "justify-center px-0 min-[769px]:justify-start min-[769px]:px-3"
                } ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.12)]"
                    : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator bar */}
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500 transition-opacity duration-200 ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${
                      isActive
                        ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25"
                        : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  >
                    <Icon name={item.icon} size={17} />
                  </span>
                  <span className={`${labelClass} truncate`}>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User footer */}
      <div className="mt-4 border-t border-slate-200/70 pt-4">
        <div
          className={`flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-100/80 ${
            showLabels ? "" : "justify-center min-[769px]:justify-start"
          }`}
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-slate-600 text-[12px] font-bold text-white ring-2 ring-white shadow-sm">
            {initials || "U"}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div className={`${textBlockClass} min-w-0 flex-col`}>
            <strong className="truncate text-[13px] font-semibold text-slate-900">{userName}</strong>
            <span className="mt-0.5 block truncate text-[11px] font-medium capitalize text-slate-400">
              {role || "Member"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
