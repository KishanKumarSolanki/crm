import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import Icon from "../components/Icon"
import { supabase } from "../lib/supabase"

export default function Unsubscribe() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState("ready")
  const [error, setError] = useState("")
  const token = params.get("token") || ""

  const unsubscribe = async () => {
    if (!token) return
    setStatus("loading")
    setError("")
    const { data, error: invokeError } = await supabase.functions.invoke("unsubscribe-broadcast", { body: { token } })
    if (invokeError || data?.error) {
      setError(invokeError?.message || data?.error || "We could not process the request. Please contact the sender.")
      setStatus("error")
    } else setStatus("done")
  }

  return <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Icon name="mail" size={21} /></div>{status === "done" ? <><h1 className="mt-5 text-xl font-bold text-slate-900">You’re unsubscribed</h1><p className="mt-2 text-sm leading-6 text-slate-500">This email address will no longer receive marketing emails from us.</p></> : <><h1 className="mt-5 text-xl font-bold text-slate-900">Email preferences</h1><p className="mt-2 text-sm leading-6 text-slate-500">Confirm that you want to stop receiving marketing emails from this sender.</p>{!token && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">This unsubscribe link is incomplete. Please contact the sender.</p>}{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}<button type="button" onClick={unsubscribe} disabled={!token || status === "loading"} className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">{status === "loading" ? "Updating preferences…" : status === "error" ? "Try again" : "Unsubscribe from marketing email"}</button></>}</section></main>
}
