import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function TeamMemberRoute({ children }) {
  const [state, setState] = useState("loading");

  useEffect(() => {
    let active = true;
    const checkRole = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        if (active) setState("unauthorized");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (active) setState(!error && ["staff", "team_member"].includes(profile?.role) ? "member" : profile?.role === "admin" ? "admin" : "unauthorized");
    };

    checkRole().catch(() => { if (active) setState("unauthorized"); });
    return () => { active = false; };
  }, []);

  if (state === "loading") return <div className="py-20 text-center text-sm text-slate-500">Checking permissions...</div>;
  if (state === "admin") return <Navigate to="/" replace />;
  if (state !== "member") return <Navigate to="/login" replace />;
  return children;
}
