import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Sidebar from "./Sidebar";
import Icon from "./Icon";

function CRMLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const notificationRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState({ clients: [], tasks: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("Current user fetch error:", userError);
        return;
      }
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, role")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Profile fetch error:", error);
        if (active) setProfile({ email: user.email || "", role: "" });
        return;
      }
      if (active) setProfile({ ...data, email: data.email || user.email || "" });
    };

    loadProfile();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) return undefined;

    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      const pattern = `%${query}%`;
      const [nameResult, emailResult, companyResult, taskResult] = await Promise.all([
        supabase.from("clients").select("id, name, email, company").ilike("name", pattern).limit(5),
        supabase.from("clients").select("id, name, email, company").ilike("email", pattern).limit(5),
        supabase.from("clients").select("id, name, email, company").ilike("company", pattern).limit(5),
        supabase.from("tasks").select("id, title, client_id").ilike("title", pattern).limit(5),
      ]);
      const error = [nameResult.error, emailResult.error, companyResult.error, taskResult.error].find(Boolean);
      if (error) {
        if (active) setSearchError(`Search failed: ${error.message}`);
      } else if (active) {
        const clientsById = new Map(
          [...(nameResult.data || []), ...(emailResult.data || []), ...(companyResult.data || [])]
            .map((client) => [String(client.id), client])
        );
        setSearchResults({
          clients: [...clientsById.values()].slice(0, 5),
          tasks: taskResult.data || [],
        });
      }
      if (active) setSearchLoading(false);
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout error:", error);
      window.alert(`Could not sign out: ${error.message}`);
      return;
    }
    navigate("/login");
  };

  const loadNotifications = async () => {
    setNotificationsLoading(true);
    setNotificationsError("");
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, due_date, client_id")
      .neq("status", "completed")
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(50);
    if (error) {
      setNotificationsError(`Could not load reminders: ${error.message}`);
    } else {
      const horizon = Date.now() + 24 * 60 * 60 * 1000;
      setNotifications((data || [])
        .filter((task) => new Date(task.due_date).getTime() <= horizon)
        .map((task) => ({
          ...task,
          overdue: new Date(task.due_date).getTime() < Date.now(),
        })));
    }
    setNotificationsLoading(false);
  };

  const toggleNotifications = async () => {
    const shouldOpen = !notificationsOpen;
    setNotificationsOpen(shouldOpen);
    setSearchOpen(false);
    if (shouldOpen) await loadNotifications();
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

  const userName = profile?.full_name || (profile?.role === "admin" ? "Admin" : "CRM User");
  const initials = userName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearch(value);
    setSearchOpen(true);
    if (value.trim().length < 2) {
      setSearchResults({ clients: [], tasks: [] });
      setSearchError("");
      setSearchLoading(false);
    }
  };

  return (
    <div className="crm-app min-h-screen bg-[#f7f8fa]">
      <Sidebar
        mobileOpen={mobileMenu}
        onNavigate={() => setMobileMenu(false)}
        userName={userName}
        role={profile?.role}
      />
      <div className="ml-[70px] min-h-screen min-[769px]:ml-[250px]">
        <header className="sticky top-0 z-[900] flex h-[68px] items-center justify-between border-b border-gray-200 bg-white px-3 min-[481px]:px-4 min-[769px]:h-[76px] min-[769px]:px-[30px]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={mobileMenu ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 min-[769px]:hidden"
            >
              <Icon name={mobileMenu ? "close" : "menu"} size={19} />
            </button>
            <div>
              <h1 className="text-[18px] font-bold leading-tight text-gray-900 min-[769px]:text-[22px]">{getPageTitle()}</h1>
              <p className="mt-1 hidden text-xs text-gray-400 min-[769px]:block">Manage your business from one place</p>
            </div>
          </div>

          <div className="flex items-center gap-2 min-[769px]:gap-3">
            <div ref={searchRef} className="relative">
              <div className="hidden h-[38px] w-[200px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 min-[650px]:flex min-[1001px]:w-[240px]">
                <Icon name="search" size={17} className="text-gray-400" />
                <input
                  type="search"
                  aria-label="Search clients and tasks"
                  placeholder="Search clients and tasks..."
                  value={search}
                  onFocus={() => { setSearchOpen(true); setNotificationsOpen(false); }}
                  onChange={handleSearchChange}
                  className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                />
              </div>
              <button
                type="button"
                aria-label="Search clients and tasks"
                onClick={() => { setSearchOpen((open) => !open); setNotificationsOpen(false); }}
                className="flex h-[36px] w-[36px] items-center justify-center rounded-lg border border-gray-200 bg-white text-lg text-gray-500 hover:bg-gray-50 min-[650px]:hidden"
              >
                <Icon name="search" size={18} />
              </button>
              {searchOpen && (
                <div className="absolute right-0 top-11 z-[1100] max-h-[70vh] w-[min(360px,90vw)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                  <input
                    type="search"
                    aria-label="Search clients and tasks"
                    placeholder="Search clients and tasks..."
                    value={search}
                    onChange={handleSearchChange}
                    className="mb-2 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-blue-500 min-[650px]:hidden"
                  />
                  {search.trim().length < 2 ? (
                    <p className="p-2 text-xs text-gray-500">Type at least 2 characters to search.</p>
                  ) : searchLoading ? (
                    <p className="p-2 text-xs text-gray-500">Searching...</p>
                  ) : searchError ? (
                    <p role="alert" className="p-2 text-xs text-red-600">{searchError}</p>
                  ) : searchResults.clients.length === 0 && searchResults.tasks.length === 0 ? (
                    <p className="p-2 text-xs text-gray-500">No matching clients or tasks.</p>
                  ) : (
                    <>
                      {searchResults.clients.length > 0 && (
                        <section>
                          <h2 className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Clients</h2>
                          {searchResults.clients.map((client) => (
                            <Link key={client.id} to={`/client/${client.id}`} onClick={() => { setSearchOpen(false); setMobileMenu(false); }} className="block rounded-lg px-2 py-2 text-sm no-underline hover:bg-gray-50">
                              <span className="block font-semibold text-gray-800">{client.name}</span>
                              <span className="block truncate text-xs text-gray-500">{client.company || client.email || "Client"}</span>
                            </Link>
                          ))}
                        </section>
                      )}
                      {searchResults.tasks.length > 0 && (
                        <section className="mt-2 border-t border-gray-100 pt-2">
                          <h2 className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Tasks</h2>
                          {searchResults.tasks.map((task) => (
                            <Link key={task.id} to={task.client_id ? `/client/${task.client_id}` : "/tasks"} onClick={() => { setSearchOpen(false); setMobileMenu(false); }} className="block rounded-lg px-2 py-2 text-sm text-gray-700 no-underline hover:bg-gray-50">
                              {task.title || "Untitled Task"}
                            </Link>
                          ))}
                        </section>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div ref={notificationRef} className="relative">
              <button
                type="button"
                title="Task reminders"
                aria-label="Task reminders"
                aria-expanded={notificationsOpen}
                onClick={toggleNotifications}
                className="relative h-[36px] w-[36px] rounded-lg border border-gray-200 bg-white text-lg text-gray-500 transition hover:bg-gray-50 min-[481px]:h-[38px] min-[481px]:w-[38px]"
              >
                <Icon name="bell" size={18} />
                {notifications.length > 0 && <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{notifications.length}</span>}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-11 z-[1100] w-[min(340px,90vw)] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-sm font-bold text-gray-800">Due soon & overdue</h2>
                    <Link to="/tasks" onClick={() => { setNotificationsOpen(false); setMobileMenu(false); }} className="text-xs font-semibold text-blue-600 no-underline hover:underline">All tasks</Link>
                  </div>
                  {notificationsLoading ? (
                    <p className="p-2 text-xs text-gray-500">Loading reminders...</p>
                  ) : notificationsError ? (
                    <p role="alert" className="p-2 text-xs text-red-600">{notificationsError}</p>
                  ) : notifications.length === 0 ? (
                    <p className="p-2 text-xs text-gray-500">No tasks due in the next 24 hours.</p>
                  ) : notifications.slice(0, 8).map((task) => (
                    <Link key={task.id} to={task.client_id ? `/client/${task.client_id}` : "/tasks"} onClick={() => { setNotificationsOpen(false); setMobileMenu(false); }} className="block rounded-lg px-2 py-2 no-underline hover:bg-gray-50">
                      <span className="block truncate text-sm font-medium text-gray-800">{task.title || "Untitled Task"}</span>
                      <span className={`text-xs ${task.overdue ? "text-red-600" : "text-amber-600"}`}>
                        {new Date(task.due_date).toLocaleString()}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 min-[769px]:border-l min-[769px]:border-gray-200 min-[769px]:pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-[12px] font-bold text-white min-[481px]:h-[34px] min-[481px]:w-[34px]">{initials || "U"}</div>
              <div className="hidden max-w-[160px] flex-col min-[1001px]:flex">
                <strong className="text-[13px] font-semibold text-gray-900">{userName}</strong>
                <span className="mt-0.5 truncate text-xs text-gray-400">{profile?.email || "Loading profile..."}</span>
              </div>
              <button type="button" onClick={handleLogout} title="Logout" aria-label="Logout" className="crm-icon-button hidden h-8 w-8 items-center justify-center rounded-[7px] text-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 min-[481px]:flex"><Icon name="logout" size={17} /></button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-3 pb-[25px] pt-4 min-[481px]:px-4 min-[481px]:pb-[30px] min-[481px]:pt-5 min-[769px]:px-[30px] min-[769px]:pb-10 min-[769px]:pt-7">
          <Outlet />
        </main>
      </div>
      {mobileMenu && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-[950] cursor-default bg-black/30 min-[769px]:hidden"
          onClick={() => setMobileMenu(false)}
        />
      )}
    </div>
  );
}

export default CRMLayout;
