import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { supabase } from "../lib/supabase"

export default function TeamMemberDetail() {
  const { id } = useParams()

  const [member, setMember] = useState(null)
  const [clients, setClients] = useState([])
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchMemberData = async () => {
    setLoading(true)

    // =========================
    // FETCH TEAM MEMBER
    // =========================
    const { data: memberData, error: memberError } = await supabase
      .from("team_members")
      .select("*")
      .eq("id", id)
      .single()

    if (memberError) {
      console.error("Member error:", memberError)
      alert(memberError.message)
      setLoading(false)
      return
    }

    setMember(memberData)

    // =========================
    // FETCH ASSIGNED CLIENTS
    // =========================
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("assigned_to", id)
      .order("created_at", { ascending: false })

    if (clientError) {
      console.error("Clients error:", clientError)
    }

    setClients(clientData || [])

    // =========================
    // FETCH TASKS
    // =========================
    const clientIds = (clientData || []).map(
      (client) => client.id
    )

    if (clientIds.length > 0) {
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .in("client_id", clientIds)
        .order("due_date", { ascending: true })

      if (taskError) {
        console.error("Tasks error:", taskError)
      }

      setTasks(taskData || [])

      // =========================
      // FETCH ACTIVITIES
      // =========================
      const { data: activityData, error: activityError } =
        await supabase
          .from("activities")
          .select("*")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })

      if (activityError) {
        console.error("Activities error:", activityError)
      }

      setActivities(activityData || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchMemberData()
  }, [id])

  // =========================
  // LOADING
  // =========================
  if (loading) {
    return (
      <div style={{ padding: "30px" }}>
        Loading team member...
      </div>
    )
  }

  // =========================
  // MEMBER NOT FOUND
  // =========================
  if (!member) {
    return (
      <div style={{ padding: "30px" }}>
        <h2>Team member not found</h2>

        <Link to="/team-members">
          ← Back to Team Members
        </Link>
      </div>
    )
  }

  // =========================
  // STATISTICS
  // =========================
  const pendingTasks = tasks.filter(
    (task) => task.status !== "completed"
  )

  const completedTasks = tasks.filter(
    (task) => task.status === "completed"
  )

  return (
    <div style={{ padding: "30px" }}>

      {/* =========================
          BACK BUTTON
      ========================= */}
      <Link
        to="/team-members"
        style={{
          textDecoration: "none"
        }}
      >
        ← Back to Team Members
      </Link>

      {/* =========================
          MEMBER HEADER
      ========================= */}
      <div
        style={{
          marginTop: "25px",
          marginBottom: "30px"
        }}
      >
        <h1>{member.name}</h1>

        <p style={{ margin: "5px 0", color: "#666" }}>
          {member.designation || "Team Member"}
        </p>

        <p style={{ margin: "5px 0", color: "#666" }}>
          {member.email || "No email"}
        </p>

        <p style={{ margin: "5px 0", color: "#666" }}>
          {member.phone || "No phone"}
        </p>

        <p>
          Status: <strong>{member.status}</strong>
        </p>
      </div>

      {/* =========================
          STATISTICS
      ========================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "20px",
          marginBottom: "35px"
        }}
      >

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "20px"
          }}
        >
          <p>Assigned Clients</p>

          <h2>{clients.length}</h2>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "20px"
          }}
        >
          <p>Pending Tasks</p>

          <h2>{pendingTasks.length}</h2>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "20px"
          }}
        >
          <p>Completed Tasks</p>

          <h2>{completedTasks.length}</h2>
        </div>

      </div>

      {/* =========================
          ASSIGNED CLIENTS
      ========================= */}
      <div style={{ marginBottom: "35px" }}>

        <h2>Assigned Clients</h2>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            overflow: "hidden",
            marginTop: "15px"
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse"
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    padding: "14px",
                    textAlign: "left"
                  }}
                >
                  Name
                </th>

                <th
                  style={{
                    padding: "14px",
                    textAlign: "left"
                  }}
                >
                  Email
                </th>

                <th
                  style={{
                    padding: "14px",
                    textAlign: "left"
                  }}
                >
                  Company
                </th>

                <th
                  style={{
                    padding: "14px",
                    textAlign: "left"
                  }}
                >
                  Stage
                </th>
              </tr>
            </thead>

            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    style={{
                      padding: "25px",
                      textAlign: "center"
                    }}
                  >
                    No clients assigned.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id}>

                    <td style={{ padding: "14px" }}>
                      <Link
                        to={`/client/${client.id}`}
                        style={{
                          textDecoration: "none",
                          fontWeight: "600"
                        }}
                      >
                        {client.name}
                      </Link>
                    </td>

                    <td style={{ padding: "14px" }}>
                      {client.email}
                    </td>

                    <td style={{ padding: "14px" }}>
                      {client.company || "-"}
                    </td>

                    <td style={{ padding: "14px" }}>
                      {client.stage}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* =========================
          TASKS
      ========================= */}
      <div style={{ marginBottom: "35px" }}>

        <h2>Tasks</h2>

        <div
          style={{
            marginTop: "15px"
          }}
        >
          {tasks.length === 0 ? (
            <p>No tasks found.</p>
          ) : (
            tasks.map((task) => {

              const taskClient = clients.find(
                (client) => client.id === task.client_id
              )

              return (
                <div
                  key={task.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: "10px",
                    padding: "15px",
                    marginBottom: "10px"
                  }}
                >
                  <h3 style={{ margin: "0 0 8px" }}>
                    {task.title}
                  </h3>

                  <p style={{ margin: "5px 0" }}>
                    Client:{" "}
                    {taskClient?.name || "Unknown"}
                  </p>

                  <p style={{ margin: "5px 0" }}>
                    Due:{" "}
                    {task.due_date
                      ? new Date(
                          task.due_date
                        ).toLocaleString()
                      : "No due date"}
                  </p>

                  <p style={{ margin: "5px 0" }}>
                    Status:{" "}
                    <strong>{task.status}</strong>
                  </p>
                </div>
              )
            })
          )}
        </div>

      </div>

      {/* =========================
          ACTIVITIES
      ========================= */}
      <div>

        <h2>Recent Activities</h2>

        <div style={{ marginTop: "15px" }}>

          {activities.length === 0 ? (
            <p>No activities found.</p>
          ) : (
            activities.map((activity) => {

              const activityClient = clients.find(
                (client) =>
                  client.id === activity.client_id
              )

              return (
                <div
                  key={activity.id}
                  style={{
                    borderLeft: "3px solid #ddd",
                    padding: "10px 15px",
                    marginBottom: "15px"
                  }}
                >
                  <strong>
                    {activity.type}
                  </strong>

                  <p style={{ margin: "5px 0" }}>
                    {activity.description}
                  </p>

                  <small>
                    Client:{" "}
                    {activityClient?.name || "Unknown"}
                  </small>

                  <br />

                  <small>
                    {activity.created_at
                      ? new Date(
                          activity.created_at
                        ).toLocaleString()
                      : ""}
                  </small>
                </div>
              )
            })
          )}

        </div>

      </div>

    </div>
  )
}