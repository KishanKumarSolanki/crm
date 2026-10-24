
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { sendWelcomeEmailWhenContacted } from "../lib/email";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";

const stages = ["discovery", "contacted", "qualified", "meeting_booked", "follow_up", "signed", "active", "in_revision", "delivered"];
const stageLabels = { discovery: "New Lead", contacted: "Contacted", qualified: "Qualified", meeting_booked: "Meeting Booked", follow_up: "Follow-up", signed: "Closed & Signed", active: "In Progress", in_revision: "In Revision", delivered: "Delivered" };

const stageStyles = {
  discovery: {
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  contacted: { badge: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  qualified: { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  meeting_booked: { badge: "bg-cyan-100 text-cyan-700", dot: "bg-cyan-500" },
  follow_up: { badge: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  signed: {
    badge: "bg-violet-100 text-violet-700",
    dot: "bg-violet-500",
  },
  active: {
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  in_revision: { badge: "bg-fuchsia-100 text-fuchsia-700", dot: "bg-fuchsia-500" },
  delivered: {
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
};

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLeads = async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("clients")
      .select("*");

    if (error) {
      setError(error.message);
    } else {
      setLeads(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Drag End Handler
  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;

    // Same stage and same position
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const leadId = draggableId;
    const newStage = destination.droppableId;

    // Optimistically update the UI
    const previousLeads = leads;

    setLeads((currentLeads) =>
      currentLeads.map((lead) =>
        String(lead.id) === leadId
          ? { ...lead, stage: newStage }
          : lead
      )
    );

    const { error } = await supabase
      .from("clients")
      .update({ stage: newStage })
      .eq("id", leadId);

    if (error) {
      setLeads(previousLeads);
      setError("Unable to update stage. Please try again.");
      return;
    }

    const movedLead = previousLeads.find((lead) => String(lead.id) === leadId);
    const { error: activityError } = await supabase.from("activities").insert({
      client_id: leadId,
      type: "stage_change",
      description: `Stage changed from ${stageLabels[movedLead?.stage] || movedLead?.stage || "Unknown"} to ${stageLabels[newStage] || newStage}`,
    });
    const { error: eventError } = await supabase.functions.invoke("process-meta-events", { body: { limit: 20 } });
    if (eventError) console.warn("Meta conversion events will be retried later:", eventError.message);

    const messages = [];
    if (activityError) messages.push(`Stage updated, but activity history could not be saved: ${activityError.message}`);

    if (newStage === "contacted" && movedLead) {
      try {
        const emailResult = await sendWelcomeEmailWhenContacted({ supabase, lead: movedLead });
        if (emailResult.status === "sent") {
          setLeads((currentLeads) => currentLeads.map((lead) =>
            String(lead.id) === leadId
              ? { ...lead, welcome_email_sent_at: emailResult.sentAt }
              : lead
          ));
          messages.push(`Welcome email sent to ${movedLead.email}.`);
        } else if (emailResult.status === "missing_email") {
          messages.push("Lead moved to Contacted, but it has no email address for the welcome email.");
        }
      } catch (emailError) {
        messages.push(`Lead moved to Contacted, but the welcome email failed: ${emailError.message}`);
      }
    }

    setError(messages.join(" "));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">

      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            CRM Management
          </p>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Sales Pipeline
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage deals from first enquiry through delivery.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
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

          <div>
            <p className="text-xs text-slate-500">Total Leads</p>
            <p className="text-xl font-bold text-slate-900">
              {leads.length}
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
            Loading pipeline...
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>

          {/* Pipeline Columns */}
          <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 2xl:grid-cols-4">

            {stages.map((stage) => {
              const stageLeads = leads.filter(
                (lead) => lead.stage === stage
              );

              const style = stageStyles[stage];

              return (
                <Droppable droppableId={stage} key={stage}>
                  {(provided, snapshot) => (
                    <section
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[320px] rounded-2xl border p-3 transition-colors sm:p-4 ${
                        snapshot.isDraggingOver
                          ? "border-indigo-300 bg-indigo-50/70"
                          : "border-slate-200 bg-slate-100/70"
                      }`}
                    >

                      {/* Column Header */}
                      <div className="mb-4 flex items-center justify-between gap-2">

                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
                          />

                          <h2 className="truncate text-sm font-bold uppercase tracking-wide text-slate-800">
                            {stageLabels[stage]}
                          </h2>
                        </div>

                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${style.badge}`}
                        >
                          {stageLeads.length}
                        </span>
                      </div>

                      {/* Lead Cards */}
                      <div className="flex flex-col gap-3">

                        {stageLeads.map((lead, index) => (
                          <Draggable
                            draggableId={String(lead.id)}
                            index={index}
                            key={lead.id}
                          >
                            {(provided, snapshot) => (
                              <article
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...provided.draggableProps.style,
                                }}
                                className={`group rounded-xl border bg-white p-4 transition-shadow ${
                                  snapshot.isDragging
                                    ? "border-indigo-300 shadow-xl"
                                    : "border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md"
                                }`}
                              >

                                <div className="flex items-start gap-3">

                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold uppercase text-slate-600">
                                    {lead.name
                                      ?.trim()
                                      ?.charAt(0) || "C"}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <h3 className="break-words text-sm font-semibold text-slate-900">
                                      {lead.name || "Unnamed Lead"}
                                    </h3>

                                    <p className="mt-1 text-xs text-slate-400">
                                      Lead #{lead.id}
                                    </p>
                                    {lead.service_name && <p className="mt-2 text-xs font-medium text-violet-700">{lead.service_name}</p>}
                                    {lead.next_follow_up && <p className="mt-1 text-xs text-slate-500">Follow-up · {new Date(lead.next_follow_up).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>}
                                  </div>

                                  <span className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-500">
                                    ⠿
                                  </span>
                                </div>

                                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">

                                  <span
                                    className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase ${style.badge}`}
                                  >
                                    {stageLabels[stage]}
                                  </span>

                                  <span className="text-[10px] text-slate-400">
                                    Drag to move
                                  </span>
                                </div>

                              </article>
                            )}
                          </Draggable>
                        ))}

                        {provided.placeholder}

                        {/* Empty State */}
                        {stageLeads.length === 0 && (
                          <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 text-center">
                            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl text-slate-400">
                              +
                            </div>

                            <p className="text-xs font-medium text-slate-500">
                              No leads yet
                            </p>

                            <p className="mt-1 text-[11px] text-slate-400">
                              Drop a lead here
                            </p>
                          </div>
                        )}
hello
                      </div>
                    </section>
                  )}
                </Droppable>
              );
            })}

          </div>
        </DragDropContext>
        
      )}
    </div>
  );
}
