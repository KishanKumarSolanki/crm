import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { supabase } from "../lib/supabase"

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      setSession(session)
      setLoading(false)
    }

    checkSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}