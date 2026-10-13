import { Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

function AdminRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    try {
      // Get logged-in user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      // Get user's profile and role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profileError || !profile) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      // Check admin role
      if (profile.role === "admin") {
        setIsAdmin(true)
      } else {
        setIsAdmin(false)
      }
    } catch (error) {
      console.error("Admin check error:", error)
      setIsAdmin(false)
    } finally {
      setLoading(false)
    }
  }

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
    return <Navigate to="/" replace />
  }

  // Admin
  return children
}

export default AdminRoute