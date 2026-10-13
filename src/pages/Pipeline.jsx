import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"

const stages = ["discovery", "signed", "active", "delivered"]

export default function Pipeline() {
  const [clients, setClients] = useState([])

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*")
    setClients(data || [])
  }

  useEffect(() => {
    fetchClients()
  }, [])

  // 🔥 Drag End Handler
  const handleDragEnd = async (result) => {
    if (!result.destination) return

    const clientId = result.draggableId
    const newStage = result.destination.droppableId

    await supabase
      .from("clients")
      .update({ stage: newStage })
      .eq("id", clientId)

    fetchClients()
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div style={{ display: "flex", gap: "20px", padding: "20px" }}>
        
        {stages.map(stage => (
          <Droppable droppableId={stage} key={stage}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                style={{
                  width: "250px",
                  border: "1px solid #ccc",
                  padding: "10px",
                  minHeight: "300px"
                }}
              >
                <h3>{stage.toUpperCase()}</h3>

                {clients
                  .filter(c => c.stage === stage)
                  .map((c, index) => (
                    <Draggable
                      draggableId={c.id.toString()}
                      index={index}
                      key={c.id}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            padding: "10px",
                            margin: "10px 0",
                            border: "1px solid black",
                            background: "white",
                            cursor: "grab",
                            ...provided.draggableProps.style
                          }}
                        >
                          {c.name}
                        </div>
                      )}
                    </Draggable>
                  ))}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}

      </div>
    </DragDropContext>
  )
}