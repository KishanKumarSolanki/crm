import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Tasks() {
  const [tasks, setTasks] = useState([])

  const fetchTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("due_date", { ascending: true })

    setTasks(data || [])
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const markDone = async (id) => {
    await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", id)

    fetchTasks()
  }

  return (
    <div style={{ padding: "30px" }}>
      <h2>Tasks (Follow-ups)</h2>

      {tasks.map(task => (
        <div key={task.id} style={{
          border: "1px solid #ccc",
          padding: "10px",
          marginBottom: "10px"
        }}>
          <p><b>{task.title}</b></p>
          <p>Due: {new Date(task.due_date).toLocaleDateString()}</p>
          <p>Status: {task.status}</p>

          {task.status !== "completed" && (
            <button onClick={() => markDone(task.id)}>
              Mark as Done
            </button>
          )}
        </div>
      ))}
    </div>
  )
}