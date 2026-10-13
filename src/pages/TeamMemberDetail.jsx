
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function TeamMemberDetail() {
  const { id } = useParams();

  const [member, setMember] = useState(null);
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMemberData = async () => {
    setLoading(true);

    try {
      const { data: memberData, error: memberError } =
        await supabase
          .from("team_members")
          .select("*")
          .eq("id", id)
          .single();

      if (memberError) {
        console.error("Member error:", memberError);
        alert(memberError.message);
        setMember(null);
        return;
      }

      setMember(memberData);

      const { data: clientData, error: clientError } =
        await supabase
          .from("clients")
          .select("*")
          .eq("assigned_to", id)
          .order("created_at", { ascending: false });

      if (clientError) {
        console.error("Clients error:", clientError);
      }

      const clientList = clientData || [];
      setClients(clientList);

      const clientIds = clientList.map((client) => client.id);

      if (clientIds.length === 0) {
        setTasks([]);
        setActivities([]);
        return;
      }

      const { data: taskData, error: taskError } =
        await supabase
          .from("tasks")
          .select("*")
          .in("client_id", clientIds)
          .order("due_date", { ascending: true });

      if (taskError) {
        console.error("Tasks error:", taskError);
      }

      setTasks(taskData || []);

      const { data: activityData, error: activityError } =
        await supabase
          .from("activities")
          .select("*")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false });

      if (activityError) {
        console.error("Activities error:", activityError);
      }

      setActivities(activityData || []);
    } catch (error) {
      console.error("Unable to fetch member data:", error);
      alert("Unable to load team member details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberData();
  }, [id]);

  const pendingTasks = tasks.filter(
    (task) => task.status !== "completed"
  );

  const completedTasks = tasks.filter(
    (task) => task.status === "completed"
  );

  const formatDate = (date) => {
    if (!date) return "No due date";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "No due date";
    }

    return parsedDate.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const stageStyles = {
    discovery: "bg-blue-50 text-blue-700",
    signed: "bg-violet-50 text-violet-700",
    active: "bg-amber-50 text-amber-700",
    delivered: "bg-emerald-50 text-emerald-700",
  };

  const statusStyles = (status) => {
    if (status === "completed") {
      return "bg-emerald-50 text-emerald-700";
    }

    if (status === "pending") {
      return "bg-amber-50 text-amber-700";
    }

    return "bg-slate-100 text-slate-600";
  };

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
          Loading team member...
        </div>
      </div>
    );
  }

  // Member Not Found
  if (!member) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-5 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
          ?
        </div>

        <h2 className="text-xl font-bold text-slate-900">
          Team member not found
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          This team member may have been deleted or is unavailable.
        </p>

        <Link
          to="/team-members"
          className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          ← Back to Team Members
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">

      {/* Back Button */}
      <Link
        to="/team-members"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
      >
        <span className="text-lg">←</span>
        Back to Team Members
      </Link>

      {/* Member Header */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="h-2 bg-gradient-to-r from-indigo-600 via-violet-500 to-blue-400" />

        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-8">

          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-3xl font-bold uppercase text-indigo-600 ring-1 ring-indigo-100">
            {member.name?.trim()?.charAt(0) || "T"}
          </div>

          <div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {member.name}
              </h1>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                  member.status === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {member.status || "Unknown"}
              </span>
            </div>

            <p className="mt-2 text-sm font-medium text-indigo-600">
              {member.designation || "Team Member"}
            </p>

            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:gap-5">

              <span className="flex min-w-0 items-center gap-2 break-all">
                <span className="text-slate-400">@</span>
                {member.email || "No email"}
              </span>

              <span className="flex items-center gap-2">
                <span className="text-slate-400">☎</span>
                {member.phone || "No phone"}
              </span>

            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Assigned Clients
            </p>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M14 3.13a4 4 0 0 1 0 7.75M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                />
              </svg>
            </div>
          </div>

          <h2 className="mt-4 text-3xl font-bold text-slate-900">
            {clients.length}
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            Clients assigned to this member
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Pending Tasks
            </p>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <circle cx="12" cy="12" r="9" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 7v5l3 2"
                />
              </svg>
            </div>
          </div>

          <h2 className="mt-4 text-3xl font-bold text-amber-600">
            {pendingTasks.length}
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            Tasks waiting to be completed
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Completed Tasks
            </p>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m5 12 4 4L19 6"
                />
              </svg>
            </div>
          </div>

          <h2 className="mt-4 text-3xl font-bold text-emerald-600">
            {completedTasks.length}
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            Successfully completed tasks
          </p>
        </div>

      </div>

      {/* Assigned Clients */}
      <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-bold text-slate-900">
            Assigned Clients
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Clients managed by this team member.
          </p>
        </div>

        {clients.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-slate-600">
              No clients assigned.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Assigned clients will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4 font-semibold sm:px-6">
                    Name
                  </th>
                  <th className="px-5 py-4 font-semibold sm:px-6">
                    Email
                  </th>
                  <th className="px-5 py-4 font-semibold sm:px-6">
                    Company
                  </th>
                  <th className="px-5 py-4 font-semibold sm:px-6">
                    Stage
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 sm:px-6">
                      <Link
                        to={`/client/${client.id}`}
                        className="font-semibold text-slate-800 transition hover:text-indigo-600"
                      >
                        {client.name || "Unnamed Client"}
                      </Link>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-500 sm:px-6">
                      {client.email || "-"}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-500 sm:px-6">
                      {client.company || "-"}
                    </td>

                    <td className="px-5 py-4 sm:px-6">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                          stageStyles[client.stage] ||
                          "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {client.stage || "Unknown"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tasks */}
      <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-bold text-slate-900">
            Tasks & Follow-ups
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Track tasks associated with assigned clients.
          </p>
        </div>

        {tasks.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            No tasks found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const taskClient = clients.find(
                (client) =>
                  String(client.id) === String(task.client_id)
              );

              return (
                <div
                  key={task.id}
                  className="flex flex-col gap-4 px-5 py-5 transition hover:bg-slate-50/70 sm:px-6 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold text-slate-900">
                      {task.title || "Untitled Task"}
                    </h3>

                    <p className="mt-2 text-xs text-slate-500">
                      Client: {taskClient?.name || "Unknown"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Due: {formatDate(task.due_date)}
                    </p>
                  </div>

                  <span
                    className={`self-start rounded-full px-3 py-1.5 text-xs font-semibold capitalize md:self-center ${
                      statusStyles(task.status)
                    }`}
                  >
                    {task.status || "Unknown"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Activities */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-bold text-slate-900">
            Recent Activities
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Recent activity history for assigned clients.
          </p>
        </div>

        {activities.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            No activities found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activities.map((activity) => {
              const activityClient = clients.find(
                (client) =>
                  String(client.id) === String(activity.client_id)
              );

              return (
                <div
                  key={activity.id}
                  className="flex gap-4 px-5 py-5 sm:px-6"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold capitalize text-slate-900">
                        {(activity.type || "Activity").replace(/_/g, " ")}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                        {activityClient?.name || "Unknown client"}
                      </span>
                    </div>

                    <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                      {activity.description || "No description available."}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      {activity.created_at
                        ? formatDate(activity.created_at)
                        : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
