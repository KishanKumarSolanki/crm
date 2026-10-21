import { Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

function AdminRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let active = true
    const checkAdmin = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) {
        if (active) setIsAdmin(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profileError) throw profileError
      if (active) setIsAdmin(profile?.role === "admin")
    }

    checkAdmin()
      .catch((error) => {
        console.error("Admin check error:", error)
        if (active) setIsAdmin(false)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [])

  // While checking user
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f8fa",
          color: "#6b7280",
          fontSize: "14px",
        }}
      >
        Checking permissions...
      </div>
    )
  }

  // Not admin
  if (!isAdmin) {
    return <Navigate to="/my-dashboard" replace />
  }

  // Admin
  return children
}

export default AdminRoute
