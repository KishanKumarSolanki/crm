import { NavLink } from "react-router-dom";
import Icon from "./Icon";

const menuItems = [
  { name: "Dashboard", path: "/", icon: "dashboard", adminOnly: true },
  { name: "My Dashboard", path: "/my-dashboard", icon: "dashboard", memberOnly: true },
  { name: "Leads", path: "/leads", icon: "leads", adminOnly: true },
  { name: "Pipeline", path: "/pipeline", icon: "pipeline", adminOnly: true },
  { name: "Marketing", path: "/marketing", icon: "marketing", adminOnly: true },
  { name: "Tasks", path: "/tasks", icon: "tasks", adminOnly: true },
  { name: "Team Members", path: "/team-members", icon: "team", adminOnly: true },
];

function Sidebar({ mobileOpen = false, onNavigate = () => {}, userName = "CRM User", role = "" }) {
  const visibleItems = menuItems.filter((item) => (!item.adminOnly || role === "admin") && (!item.memberOnly || ["staff", "team_member"].includes(role)));
  const initials = userName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <aside
      id="crm-navigation"
      aria-label="Main navigation"
      className={`crm-sidebar fixed left-0 top-0 z-[1000] flex h-screen flex-col border-r border-gray-200 bg-white py-[22px] transition-[width] duration-200 ${
        mobileOpen
          ? "w-[250px] min-w-[250px] px-[14px]"
          : "w-[70px] min-w-[70px] px-[9px] min-[769px]:w-[250px] min-[769px]:min-w-[250px] min-[769px]:px-[14px]"
      }`}
    >
      <div className={`flex items-center gap-[11px] border-b border-gray-100 px-2 pb-6 pt-1 ${mobileOpen ? "" : "justify-center min-[769px]:justify-start"}`}>
        <div className="crm-logo-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-gray-900 text-[18px] font-bold text-white">C<span>.</span></div>
        <div className={`${mobileOpen ? "" : "hidden min-[769px]:block"}`}>
          <h2 className="text-[18px] font-bold leading-tight text-gray-900">CRM</h2>
          <span className="mt-[3px] block text-xs leading-tight text-gray-400">Management System</span>
        </div>
      </div>

      <div className="mt-[27px]">
        <p className={`mx-[10px] mb-[10px] text-xs font-bold tracking-[0.08em] text-gray-400 ${mobileOpen ? "" : "hidden min-[769px]:block"}`}>MAIN MENU</p>
        <nav className="flex flex-col gap-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onNavigate}
              title={!mobileOpen ? item.name : undefined}
              className={({ isActive }) =>
                `flex min-h-[43px] items-center gap-3 rounded-[9px] px-3 text-sm font-medium no-underline transition-colors duration-200 ${
                  mobileOpen ? "" : "justify-center px-0 min-[769px]:justify-start min-[769px]:px-3"
                } ${
                  isActive
                    ? "crm-nav-active bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center"><Icon name={item.icon} size={19} /></span>
              <span className={`${mobileOpen ? "" : "hidden min-[769px]:inline"}`}>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className={`mt-auto border-t border-gray-100 px-[6px] pb-1 pt-[14px] ${mobileOpen ? "" : "min-[769px]:block"}`}>
        <div className={`flex items-center gap-[10px] p-2 ${mobileOpen ? "" : "justify-center px-0 min-[769px]:justify-start min-[769px]:px-2"}`}>
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-slate-100 text-[12px] font-bold text-gray-900">{initials || "U"}</div>
          <div className={`${mobileOpen ? "" : "hidden min-[769px]:flex"} min-w-0 flex-col`}>
            <strong className="truncate text-[13px] font-semibold text-gray-900">{userName}</strong>
            <span className="mt-0.5 text-xs capitalize text-gray-400">{role || "Member"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
