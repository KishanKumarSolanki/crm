import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";

// =========================
// CONSTANTS
// =========================

const AVATAR_TONES = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-rose-500 to-pink-600",
  "from-slate-600 to-slate-800",
];

const EMPTY_FORM = { name: "", email: "", phone: "", designation: "" };

// =========================
// HELPERS
// =========================

const toneFor = (seed = "") => {
  const sum = [...String(seed)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
};

const initialOf = (name) => (name?.trim()?.charAt(0) || "T").toUpperCase();

// =========================
// UI PRIMITIVES
// =========================

const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10";

const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";

const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

const btnGhost =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900";

const Avatar = ({ name, seed, size = "md" }) => {
  const sizes = {
    sm: "h-9 w-9 rounded-xl text-[13px]",
    md: "h-10 w-10 rounded-xl text-sm",
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br ${toneFor(seed)} ${sizes[size]} font-bold text-white shadow-sm`}
    >
      {initialOf(name)}
    </div>
  );
};

const StatCard = ({ label, value, icon, chip, valueClass = "text-slate-900" }) => (
  <div className={`${cardClass} group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5`}>
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ${chip}`}>
      <Icon name={icon} size={20} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${valueClass}`}>{value}</p>
    </div>
  </div>
);

const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/70 ${className}`} />
);

const LoadingSkeleton = () => (
  <div className="w-full space-y-6">
    <SkeletonBlock className="h-20" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-24" />)}
    </div>
    <SkeletonBlock className="h-96" />
  </div>
);

const FormField = ({ id, label, required, hint, children }) => (
  <div>
    <label htmlFor={id} className={labelClass}>
      {label}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
      {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
    </label>
    {children}
  </div>
);

// =========================
// PAGE
// =========================

export default function TeamMembers() {
  const [members, setMembers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [roleSaving, setRoleSaving] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");

  const updateField = (field) => (e) =>
    setForm((current) => ({ ...current, [field]: e.target.value }));

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(error.message);
    } else {
      setMembers(data || []);
    }

    setFetching(false);
  };

  const fetchAccounts = async () => {
    const { data, error } = await supabase.from("profiles").select("id,full_name,email,role").order("email", { ascending: true });
    if (error) console.error("Profile role list error:", error);
    else setAccounts(data || []);
  };

  useEffect(() => {
    fetchMembers();
    fetchAccounts();
  }, []);

  const changeRole = async (profile, role) => {
    setRoleSaving(profile.id);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", profile.id);
    if (error) alert(`Could not update role: ${error.message}`);
    else setAccounts((current) => current.map((item) => item.id === profile.id ? { ...item, role } : item));
    setRoleSaving("");
  };

  const handleAddMember = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      alert("Please enter the team member name and login email");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("team_members").insert([
      {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        designation: form.designation.trim(),
        status: "active",
      },
    ]);

    if (error) {
      console.error(error);
      alert(error.message);
    } else {
      alert("Team member added successfully");
      setForm(EMPTY_FORM);
      setShowForm(false);
      await fetchMembers();
    }

    setLoading(false);
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this team member?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("team_members").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchMembers();
  };

  // =========================
  // DERIVED DATA
  // =========================

  const activeCount = useMemo(
    () => members.filter((m) => m.status === "active").length,
    [members]
  );

  const linkedCount = useMemo(
    () => members.filter((m) => m.profile_id).length,
    [members]
  );

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter(
      (m) =>
        m.name?.toLowerCase().includes(query) ||
        m.email?.toLowerCase().includes(query) ||
        m.designation?.toLowerCase().includes(query)
    );
  }, [members, search]);

  const stats = [
    { label: "Total members", value: members.length, icon: "team", chip: "bg-indigo-50 text-indigo-600 ring-indigo-100" },
    { label: "Active", value: activeCount, icon: "check", chip: "bg-emerald-50 text-emerald-600 ring-emerald-100", valueClass: "text-emerald-600" },
    { label: "Linked logins", value: linkedCount, icon: "leads", chip: "bg-violet-50 text-violet-600 ring-violet-100", valueClass: "text-violet-600" },
  ];

  // =========================
  // RENDER
  // =========================

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* HEADER */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Link to="/" className="no-underline transition hover:text-slate-700">CRM</Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-600">Team</span>
            </nav>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Team members</h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-500">
              Manage your team members, their details and login access.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            className={`${showForm ? btnGhost : btnPrimary} self-start sm:self-auto`}
            aria-expanded={showForm}
          >
            <Icon name={showForm ? "close" : "plus"} size={16} />
            {showForm ? "Close" : "Add member"}
          </button>
        </div>
      </header>

      {/* LOGIN NOTICE */}
      <div className="flex items-start gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/70 px-4 py-3.5 text-sm text-violet-900">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
        <p className="leading-relaxed">
          <strong className="font-semibold">Login setup:</strong> Add a unique email here, then create or invite that same email under
          Supabase Authentication → Users. Set its profile role to{" "}
          <code className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[12px] text-violet-800 ring-1 ring-violet-100">manager</code> or{" "}
          <code className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[12px] text-violet-800 ring-1 ring-violet-100">staff</code>. Use Login roles below to change an account later.
          Matching emails link automatically after the migration is applied.
        </p>
      </div>

      {/* LOGIN ROLES */}
      <section className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-bold text-slate-900">Login roles</h2>
          <p className="mt-1 text-xs text-slate-500">Choose which dashboard and permissions each authenticated account receives.</p>
        </div>
        {accounts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No login profiles found yet. Create the account in Supabase Authentication first.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {accounts.map((account) => (
              <div key={account.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{account.full_name || account.email || "CRM account"}</p>
                  <p className="truncate text-xs text-slate-400">{account.email || account.id}</p>
                </div>
                <label className="sr-only" htmlFor={`role-${account.id}`}>Role for {account.email || account.id}</label>
                <select id={`role-${account.id}`} value={account.role || "staff"} disabled={roleSaving === account.id} onChange={(event) => changeRole(account, event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50">
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="staff">Team Member</option>
                  <option value="team_member">Team Member (legacy)</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* STATS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* ADD FORM */}
      {showForm && (
        <form
          onSubmit={handleAddMember}
          className={`${cardClass} max-w-4xl overflow-hidden`}
        >
          <div className="flex items-start gap-3.5 border-b border-slate-100 px-5 py-5 sm:px-7">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
              <Icon name="plus" size={18} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-slate-900">Add team member</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Use the same email address you will create in Supabase Auth.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 sm:p-7">
            <FormField id="member-name" label="Full name" required>
              <input
                id="member-name"
                type="text"
                placeholder="Enter name"
                value={form.name}
                onChange={updateField("name")}
                required
                className={`${inputClass} mt-0`}
              />
            </FormField>

            <FormField id="member-email" label="Login email" required>
              <input
                id="member-email"
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={updateField("email")}
                required
                className={`${inputClass} mt-0`}
              />
            </FormField>

            <FormField id="member-phone" label="Phone number">
              <input
                id="member-phone"
                type="tel"
                placeholder="Enter phone"
                value={form.phone}
                onChange={updateField("phone")}
                className={`${inputClass} mt-0`}
              />
            </FormField>

            <FormField id="member-designation" label="Designation">
              <input
                id="member-designation"
                type="text"
                placeholder="e.g. Sales Executive"
                value={form.designation}
                onChange={updateField("designation")}
                className={`${inputClass} mt-0`}
              />
            </FormField>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className={`${btnGhost} sm:w-auto`}
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Adding member...
                </>
              ) : (
                <>
                  <Icon name="plus" size={15} />
                  Add member
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* LIST */}
      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900">All team members</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {filteredMembers.length} of {members.length} shown
            </p>
          </div>

          <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 sm:w-64">
            <Icon name="search" size={15} className="text-slate-400" />
            <input
              type="text"
              aria-label="Search team members"
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {fetching ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
            Loading team members...
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center">
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Icon name="team" size={24} />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No team members yet</h3>
            <p className="text-xs text-slate-500">Add your first team member to get started.</p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className={`${btnPrimary} mt-3`}
            >
              <Icon name="plus" size={15} />
              Add member
            </button>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-slate-500">
            No members match "{search}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/70">
                  {["Team member", "Email", "Phone", "Designation", "Login", "Status", ""].map((h, i) => (
                    <th
                      key={h + i}
                      className={`whitespace-nowrap border-b border-slate-100 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 ${
                        i === 6 ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredMembers.map((member) => {
                  const linked = Boolean(member.profile_id);
                  const active = member.status === "active";
                  return (
                    <tr key={member.id} className="group transition hover:bg-slate-50/70">
                      <td className="border-b border-slate-100 px-5 py-3.5">
                        <Link
                          to={`/team-member/${member.id}`}
                          className="flex items-center gap-3 text-inherit no-underline"
                        >
                          <Avatar name={member.name} seed={member.id} />
                          <span className="text-sm font-semibold text-slate-900 transition group-hover:text-indigo-700">
                            {member.name}
                          </span>
                        </Link>
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5 text-[13px] text-slate-600">
                        {member.email || <span className="text-slate-300">—</span>}
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5 text-[13px] text-slate-600">
                        {member.phone || <span className="text-slate-300">—</span>}
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5 text-[13px] text-slate-600">
                        {member.designation || <span className="text-slate-300">—</span>}
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                            linked
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                              : "bg-amber-50 text-amber-700 ring-amber-100"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${linked ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {linked ? "Linked" : "Awaiting login"}
                        </span>
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ${
                            active
                              ? "bg-slate-900 text-white ring-slate-900"
                              : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {member.status || "Unknown"}
                        </span>
                      </td>

                      <td className="border-b border-slate-100 px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(member.id)}
                          className="inline-flex h-8 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
