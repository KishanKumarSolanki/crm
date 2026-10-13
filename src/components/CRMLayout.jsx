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
    <div className="min-h-screen bg-[#f7f8fa]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Area */}
      <div className="ml-[70px] min-h-screen min-[769px]:ml-[250px]">
        {/* Header */}
        <header className="sticky top-0 z-[900] flex h-[68px] items-center justify-between border-b border-gray-200 bg-white px-3 min-[481px]:px-4 min-[769px]:h-[76px] min-[769px]:px-[30px]">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 max-[768px]:flex"
            >
              ☰
            </button>

            <div>
              <h1 className="text-[18px] font-bold leading-tight text-gray-900 min-[769px]:text-[22px]">
                {getPageTitle()}
              </h1>
              <p className="mt-1 hidden text-xs text-gray-400 min-[769px]:block">
                Manage your business from one place
              </p>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-[7px] min-[769px]:gap-3">
            {/* Search */}
            <div className="hidden h-[38px] w-[200px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 min-[1001px]:flex">
              <span className="text-lg text-gray-400">⌕</span>

              <input
                type="text"
                placeholder="Search..."
                onChange={() => {}}
                className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
              />
            </div>

            {/* Notification */}
            <button
              title="Notifications"
              className="relative h-[34px] w-[34px] rounded-lg border border-gray-200 bg-white text-[17px] text-gray-500 transition hover:bg-gray-50 min-[481px]:h-[38px] min-[481px]:w-[38px]"
            >
              ♧
              <span className="absolute right-2 top-2 h-[6px] w-[6px] rounded-full bg-red-500"></span>
            </button>

            {/* User */}
            <div className="flex items-center gap-[10px] min-[769px]:border-l min-[769px]:border-gray-200 min-[769px]:pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-[13px] font-bold text-white min-[481px]:h-[34px] min-[481px]:w-[34px]">
                A
              </div>

              <div className="hidden max-w-[160px] flex-col min-[1001px]:flex">
                <strong className="text-[13px] font-semibold text-gray-900">
                  Admin
                </strong>
                <span className="mt-0.5 truncate text-xs text-gray-400">
                  {userEmail || "Administrator"}
                </span>
              </div>

              <button
                onClick={handleLogout}
                title="Logout"
                className="hidden h-8 w-8 rounded-[7px] text-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 min-[481px]:block"
              >
                ↪
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto max-w-[1600px] px-3 pb-[25px] pt-4 min-[481px]:px-4 min-[481px]:pb-[30px] min-[481px]:pt-5 min-[769px]:px-[30px] min-[769px]:pb-10 min-[769px]:pt-7">
          <Outlet />
        </main>
      </div>

      {/* Mobile Overlay */}
      {mobileMenu && (
        <div
          className="fixed inset-0 z-[950] bg-black/30"
          onClick={() => setMobileMenu(false)}
        ></div>
      )}
    </div>
  );
}

export default CRMLayout;