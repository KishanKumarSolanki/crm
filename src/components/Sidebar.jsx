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
    <aside className="fixed left-0 top-0 z-[1000] flex h-screen w-[250px] min-w-[250px] flex-col border-r border-gray-200 bg-white px-[14px] py-[22px] max-[768px]:w-[70px] max-[768px]:min-w-[70px] max-[768px]:px-[9px] max-[768px]:py-4">
      {/* Logo */}
      <div className="flex items-center gap-[11px] border-b border-gray-100 px-2 pb-6 pt-1 max-[768px]:justify-center max-[768px]:px-0 max-[768px]:pb-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-gray-900 text-[18px] font-bold text-white">
          C
        </div>

        <div className="max-[768px]:hidden">
          <h2 className="text-[18px] font-bold leading-tight text-gray-900">
            CRM
          </h2>
          <span className="mt-[3px] block text-xs leading-tight text-gray-400">
            Management System
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-[27px]">
        <p className="mx-[10px] mb-[10px] text-xs font-bold tracking-[0.08em] text-gray-400 max-[768px]:hidden">
          MAIN MENU
        </p>

        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `flex min-h-[43px] items-center gap-3 rounded-[9px] px-3 text-sm font-medium no-underline transition-colors duration-200 max-[768px]:justify-center max-[768px]:px-0 ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base max-[768px]:w-6">
                {item.icon}
              </span>

              <span className="max-[768px]:hidden">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom User Area */}
      <div className="mt-auto border-t border-gray-100 px-[6px] pb-1 pt-[14px]">
        <div className="flex items-center gap-[10px] p-2 max-[768px]:justify-center max-[768px]:px-0">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold text-gray-900">
            A
          </div>

          <div className="flex min-w-0 flex-col max-[768px]:hidden">
            <strong className="text-[13px] font-semibold text-gray-900">
              Admin
            </strong>
            <span className="mt-0.5 text-xs text-gray-400">Administrator</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;