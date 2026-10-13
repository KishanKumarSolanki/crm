
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");

  const fetchTasks = async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("due_date", { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setTasks(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const markDone = async (id) => {
    setUpdatingId(id);
    setError("");

    const { error } = await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", id);

    if (error) {
      setError(error.message);
    } else {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === id
            ? { ...task, status: "completed" }
            : task
        )
      );
    }

    setUpdatingId(null);
  };

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
      case "pending":
        return "bg-amber-50 text-amber-700 ring-amber-600/20";
      case "in progress":
        return "bg-blue-50 text-blue-700 ring-blue-600/20";
      default:
        return "bg-slate-100 text-slate-600 ring-slate-500/20";
    }
  };

  const formatDate = (date) => {
    if (!date) return "No due date";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Invalid date";
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const completedCount = tasks.filter(
    (task) => task.status?.toLowerCase() === "completed"
  ).length;

  const pendingCount = tasks.length - completedCount;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">

      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            CRM Management
          </p>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Tasks & Follow-ups
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage your tasks and stay on top of client follow-ups.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTasks}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 7v5h-5M4 17v-5h5"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5.6 9a7 7 0 0 1 12-2L20 12M4 12l2.4 5a7 7 0 0 0 12-2"
            />
          </svg>
          Refresh Tasks
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Tasks
          </p>

          <p className="mt-3 text-3xl font-bold text-slate-900">
            {tasks.length}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            All follow-up activities
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Pending Tasks
          </p>

          <p className="mt-3 text-3xl font-bold text-amber-600">
            {pendingCount}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Tasks yet to be completed
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Completed Tasks
          </p>

          <p className="mt-3 text-3xl font-bold text-emerald-600">
            {completedCount}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Successfully completed
          </p>
        </div>
      </div>

      {/* Task List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              All Tasks
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Tasks sorted by due date
            </p>
          </div>

          <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
            {tasks.length} tasks
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-56 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
              Loading tasks...
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">

            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-7 w-7"
              >
                <rect
                  x="4"
                  y="3"
                  width="16"
                  height="18"
                  rx="2"
                />
                <path
                  strokeLinecap="round"
                  d="M8 8h8M8 12h8M8 16h5"
                />
              </svg>
            </div>

            <h3 className="text-base font-semibold text-slate-800">
              No tasks found
            </h3>

            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Your follow-up tasks will appear here when available.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">

            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-4 px-5 py-5 transition hover:bg-slate-50/70 sm:px-6 md:flex-row md:items-center md:justify-between"
              >

                {/* Task Details */}
                <div className="flex min-w-0 flex-1 items-start gap-4">

                  <div
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      task.status?.toLowerCase() === "completed"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    {task.status?.toLowerCase() === "completed" ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-5 w-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m5 12 4 4L19 6"
                        />
                      </svg>
                    ) : (
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
                    )}
                  </div>

                  <div className="min-w-0 flex-1">

                    <h3
                      className={`break-words text-sm font-semibold ${
                        task.status?.toLowerCase() === "completed"
                          ? "text-slate-500 line-through"
                          : "text-slate-900"
                      }`}
                    >
                      {task.title || "Untitled Task"}
                    </h3>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">

                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="h-4 w-4"
                        >
                          <rect
                            x="3"
                            y="5"
                            width="18"
                            height="16"
                            rx="2"
                          />
                          <path
                            strokeLinecap="round"
                            d="M16 3v4M8 3v4M3 10h18"
                          />
                        </svg>
                        Due: {formatDate(task.due_date)}
                      </span>

                      <span className="text-xs text-slate-400">
                        Task #{task.id}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status and Action */}
                <div className="flex flex-wrap items-center gap-3 pl-14 sm:pl-0">

                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold capitalize ring-1 ring-inset ${getStatusStyle(
                      task.status
                    )}`}
                  >
                    {task.status || "Unknown"}
                  </span>

                  {task.status?.toLowerCase() !== "completed" && (
                    <button
                      type="button"
                      onClick={() => markDone(task.id)}
                      disabled={updatingId === task.id}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingId === task.id ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-4 w-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m5 12 4 4L19 6"
                            />
                          </svg>
                          Mark as Done
                        </>
                      )}
                    </button>
                  )}

                </div>
              </div>
            ))}

          </div>
        )}
      </div>
    </div>
  );
}
