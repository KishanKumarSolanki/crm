import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const features = [
  "Keep every lead organized in one place.",
  "Assign follow-ups and stay aligned as a team.",
  "Track every opportunity from first contact to close.",
];

const ALLOWED_ROLES = ["admin", "manager", "staff", "team_member"];

function BrandMark({ light = false }) {
  return (
    <div className={`flex h-11 w-11 items-center justify-center rounded-[14px] text-lg font-bold shadow-sm ${light ? "bg-white text-slate-950" : "bg-slate-950 text-white"}`} aria-hidden="true">
      C<span className="text-blue-500">.</span>
    </div>
  );
}

function getRedirectPath(role) {
  if (role === "admin") return "/";
  if (role === "manager") return "/manager-dashboard";
  return "/my-dashboard";
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Profile aur role check, password login aur Google login dono ke liye
  const validateProfileAndRedirect = async (userId) => {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      setErrorMessage("We couldn't find your user profile. Please contact your administrator.");
      await supabase.auth.signOut();
      return;
    }

    if (!ALLOWED_ROLES.includes(profile.role)) {
      setErrorMessage("This account does not have CRM access. Please contact your administrator.");
      await supabase.auth.signOut();
      return;
    }

    navigate(getRedirectPath(profile.role));
  };

  // Google se redirect hokar wapas aane par session check karo
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setGoogleLoading(true);
      try {
        await validateProfileAndRedirect(session.user.id);
      } finally {
        setGoogleLoading(false);
      }
    };

    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await validateProfileAndRedirect(data.user.id);
    } catch (error) {
      setErrorMessage(error.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage("");
    setGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="login-card">
        <section className="login-brand" aria-label="About CRM">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_14%,rgba(139,92,246,0.42),transparent_34%),radial-gradient(ellipse_at_88%_88%,rgba(84,43,170,0.48),transparent_43%)]" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border border-white/[0.07]" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-1.5 w-2/3 rounded-r-full bg-violet-400/80" />

          <div className="login-brand-head">
            <BrandMark light />
            <div>
              <div className="text-[15px] font-semibold tracking-[-0.03em]">CRM</div>
              <div className="mt-0.5 text-[11px] text-violet-200/75">Lead relationships, made clear</div>
            </div>
          </div>

          <div className="login-brand-copy">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[11px] font-medium text-violet-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Your business, in sync
            </div>
            <h1 className="login-brand-title">
              Great work starts with <span>great relationships.</span>
            </h1>
            <p className="login-brand-description">
              Keep leads, follow-ups, and your team moving forward together.
            </p>

            <div className="login-features">
              {features.map((feature) => (
                <div key={feature}>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] text-violet-200" aria-hidden="true">&#10003;</span>
                  {feature}
                </div>
              ))}
            </div>
            <div className="login-illustration" aria-hidden="true"><span className="login-sun" /><span className="login-person-head" /><span className="login-person-body" /><span className="login-desk" /><span className="login-laptop" /><span className="login-plant" /></div>
          </div>

          <div className="login-brand-foot">&copy; {new Date().getFullYear()} CRM Management System</div>
        </section>

        <section className="login-form-panel" aria-label="Sign in">
          <div className="login-form-content">
            <div className="login-mobile-brand">
              <BrandMark />
              <div>
                <div className="text-sm font-semibold">CRM</div>
                <div className="text-xs text-slate-500">Lead relationships, made clear</div>
              </div>
            </div>

            <div className="login-form-heading">
              <div className="login-eyebrow">Welcome back</div>
              <h2>Sign in to your CRM</h2>
              <p>Good to see you. Let's get you back to work.</p>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              <div>
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setErrorMessage(""); }}
                  autoComplete="email"
                  required
                  className="login-input"
                />
              </div>

              <div>
                <div className="login-password-label">
                  <label htmlFor="password">Password</label>
                  <button
                    type="button"
                    onClick={() => setErrorMessage("Please contact your administrator to reset your password.")}
                    className="login-forgot"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="login-password-wrap">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => { setPassword(event.target.value); setErrorMessage(""); }}
                    autoComplete="current-password"
                    required
                    className="login-input login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="login-show-password"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div role="alert" className="login-error">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="login-submit"
              >
                {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Signing in...</> : <>Sign in <span aria-hidden="true">&#8594;</span></>}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-5 w-5 items-center justify-center text-base font-bold" aria-hidden="true">
                <span className="text-[#4285F4]">G</span>
              </span>
              {googleLoading ? "Redirecting..." : "Google se sign in karo"}
            </button>

            <p className="login-privacy">Secure sign-in &middot; Your lead and team information stays private</p>
          </div>
        </section>
      </div>
    </main>
  );
}