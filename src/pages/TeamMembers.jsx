
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";

export default function TeamMembers() {
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

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

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleAddMember = async (e) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      alert("Please enter the team member name and login email");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("team_members")
      .insert([
        {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          designation: designation.trim(),
          status: "active",
        },
      ]);

    if (error) {
      console.error(error);
      alert(error.message);
    } else {
      alert("Team member added successfully");

      setName("");
      setEmail("");
      setPhone("");
      setDesignation("");
      setShowForm(false);

      await fetchMembers();
    }

    setLoading(false);
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this team member?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchMembers();
  };

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

  const labelClass =
    "block text-sm font-medium text-slate-700";

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">

      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            CRM Management
          </p>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Team Members
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage your team members and their information.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className={`inline-flex items-center justify-center gap-2 self-start rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition sm:self-auto ${
            showForm
              ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          {showForm ? (
            <>
              <span className="text-lg">×</span>
              Close
            </>
          ) : (
            <>
              <span className="text-lg">+</span>
              Add Member
            </>
          )}
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950">
        <strong>Login setup:</strong> Add a unique email here, then create/invite that same email under Supabase Authentication → Users. Set its profile role to <code className="rounded bg-white px-1.5 py-0.5">staff</code>. Matching emails link automatically after the migration is applied.
      </div>

      {/* Summary */}
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M14 3.13a4 4 0 0 1 0 7.75M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                />
              </svg>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Total Team Members
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {members.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m5 12 4 4L19 6"
                />
              </svg>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Active Members
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {members.filter(
                  (member) => member.status === "active"
                ).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Member Form */}
      {showForm && (
        <form
          onSubmit={handleAddMember}
          className="mb-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="mb-6 border-b border-slate-100 pb-5">
            <h2 className="text-lg font-bold text-slate-900">
              Add Team Member
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Use the same email address you will create in Supabase Auth.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="member-name" className={labelClass}>
                Full Name *
              </label>
              <input
                id="member-name"
                type="text"
                placeholder="Enter name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="member-email" className={labelClass}>
                Email Address
              </label>
              <input
                id="member-email"
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="member-phone" className={labelClass}>
                Phone Number
              </label>
              <input
                id="member-phone"
                type="tel"
                placeholder="Enter phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="member-designation" className={labelClass}>
                Designation
              </label>
              <input
                id="member-designation"
                type="text"
                placeholder="e.g. Sales Executive"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {loading ? "Adding Member..." : "Add Member"}
            </button>
          </div>
        </form>
      )}

      {/* Team Members Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              All Team Members
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              View and manage your team.
            </p>
          </div>

          <span className="self-start rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
            {members.length} members
          </span>
        </div>

        {fetching ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
            Loading team members...
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-7 w-7"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M14 3.13a4 4 0 0 1 0 7.75M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                />
              </svg>
            </div>

            <h3 className="text-base font-semibold text-slate-800">
              No team members found
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Add your first team member to get started.
            </p>

            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              + Add Member
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[930px] text-left">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 font-semibold">Team Member</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Phone</th>
                  <th className="px-6 py-4 font-semibold">Designation</th>
                  <th className="px-6 py-4 font-semibold">Login account</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 text-right font-semibold">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="transition hover:bg-slate-50/80"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold uppercase text-indigo-600">
                          {member.name?.trim().charAt(0) || "T"}
                        </div>

                        <Link
                          to={`/team-member/${member.id}`}
                          className="font-semibold text-slate-800 transition hover:text-indigo-600"
                        >
                          {member.name}
                        </Link>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {member.email || "-"}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {member.phone || "-"}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {member.designation || "-"}
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${member.profile_id ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {member.profile_id ? "Linked" : "Awaiting matching login"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                          member.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {member.status || "Unknown"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(member.id)}
                        className="rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
