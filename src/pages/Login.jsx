
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        alert(error.message);
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("id", data.user.id)
          .single();

      if (profileError || !profile) {
        alert("User profile not found");
        await supabase.auth.signOut();
        return;
      }

      console.log("Logged in user:", profile);
      navigate("/");
    } catch (error) {
      alert(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      title: "Client Management",
      description: "Keep every client organized in one place.",
    },
    {
      title: "Team Collaboration",
      description: "Assign clients and follow-ups to your team.",
    },
    {
      title: "Sales Pipeline",
      description: "Track every opportunity from start to finish.",
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#f7f8fa] font-sans text-gray-900">

      {/* LEFT BRAND SECTION */}
      <aside className="relative hidden w-[48%] flex-col justify-between overflow-hidden bg-gray-900 px-10 py-12 text-white md:flex lg:px-16 lg:py-14">

        <div className="pointer-events-none absolute -right-[170px] -top-[170px] h-[420px] w-[420px] rounded-full border border-white/[0.07]" />

        <div className="pointer-events-none absolute -bottom-[350px] -left-[350px] h-[600px] w-[600px] rounded-full border border-white/[0.05]" />

        <div className="relative z-10 max-w-[500px]">

          <div className="mb-12 flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-white text-xl font-extrabold text-gray-900 lg:mb-[60px]">
            C
          </div>

          <h1 className="text-[32px] font-bold leading-[1.08] tracking-[-1.7px] lg:text-[clamp(32px,3.4vw,50px)]">
            Manage your business.
            <br />
            <span className="text-gray-400">
              Grow your relationships.
            </span>
          </h1>

          <p className="mt-[22px] max-w-[430px] text-[13px] leading-[1.7] text-gray-400">
            A smarter way to manage clients, tasks,
            team members and your complete sales pipeline.
          </p>

          <div className="mt-9 flex flex-col gap-5 lg:mt-12">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">

                <div className="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[7px] border border-white/[0.13] text-[10px] text-gray-300">
                  ✓
                </div>

                <div>
                  <strong className="block text-[11px] font-semibold text-gray-50">
                    {feature.title}
                  </strong>

                  <span className="mt-1 block text-[9px] leading-relaxed text-gray-500">
                    {feature.description}
                  </span>
                </div>

              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[9px] text-gray-600">
          © {new Date().getFullYear()} CRM Management System
        </div>
      </aside>

      {/* RIGHT LOGIN SECTION */}
      <main className="flex min-h-screen flex-1 items-center justify-center px-5 py-[30px] sm:px-10 md:px-8 lg:px-10">

        <div className="w-full max-w-[390px]">

          {/* MOBILE LOGO */}
          <div className="mb-10 flex items-center gap-3 md:hidden">

            <div className="flex h-[35px] w-[35px] items-center justify-center rounded-lg bg-gray-900 text-[15px] font-bold text-white">
              C
            </div>

            <div>
              <strong className="block text-[13px] text-gray-900">
                CRM
              </strong>

              <span className="mt-0.5 block text-[9px] text-gray-400">
                Management System
              </span>
            </div>
          </div>

          {/* HEADER */}
          <div className="mb-[29px]">

            <div className="mb-[17px] flex h-[37px] w-[37px] items-center justify-center rounded-[9px] bg-gray-900 text-lg text-white">
              →
            </div>

            <h2 className="text-[27px] font-bold tracking-[-0.7px] text-gray-900">
              Welcome back
            </h2>

            <p className="mt-[7px] text-[11px] leading-relaxed text-gray-400">
              Sign in to continue to your CRM dashboard.
            </p>
          </div>

          {/* LOGIN FORM */}
          <form onSubmit={handleLogin}>

            {/* EMAIL */}
            <div className="mb-[18px]">

              <label
                htmlFor="email"
                className="mb-[7px] block text-[10px] font-semibold text-gray-700"
              >
                Email Address
              </label>

              <div className="flex h-[45px] items-center rounded-lg border border-[#e1e4e8] bg-white transition focus-within:border-gray-400 focus-within:ring-[3px] focus-within:ring-gray-900/[0.05]">

                <span className="flex w-[38px] shrink-0 items-center justify-center text-sm text-zinc-400">
                  @
                </span>

                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="h-full min-w-0 flex-1 bg-transparent pr-2 text-[11px] text-gray-900 outline-none placeholder:text-[#b1b5bc]"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="mb-[18px]">

              <div className="flex items-center justify-between">

                <label
                  htmlFor="password"
                  className="mb-[7px] block text-[10px] font-semibold text-gray-700"
                >
                  Password
                </label>

                <button
                  type="button"
                  onClick={() =>
                    alert(
                      "Please contact your administrator to reset your password."
                    )
                  }
                  className="mb-[7px] text-[9px] font-medium text-gray-500 hover:text-gray-900 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <div className="flex h-[45px] items-center rounded-lg border border-[#e1e4e8] bg-white transition focus-within:border-gray-400 focus-within:ring-[3px] focus-within:ring-gray-900/[0.05]">

                <span className="flex w-[38px] shrink-0 items-center justify-center text-sm text-zinc-400">
                  •
                </span>

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-full min-w-0 flex-1 bg-transparent pr-1 text-[11px] text-gray-900 outline-none placeholder:text-[#b1b5bc]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="mr-2 rounded px-1.5 py-1 text-[8px] font-semibold text-gray-400 hover:text-gray-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* LOGIN BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="mt-[25px] flex h-[45px] w-full items-center justify-center gap-2.5 rounded-lg bg-gray-900 text-[11px] font-semibold text-white transition hover:-translate-y-px hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-65"
            >
              {loading ? (
                <>
                  <span className="h-[13px] w-[13px] animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <span className="text-[15px]">→</span>
                </>
              )}
            </button>

          </form>

          {/* SECURITY INFO */}
          <div className="mt-[22px] flex items-start gap-[9px] rounded-lg border border-[#eef0f2] bg-[#fafafa] p-3">

            <div className="flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-md bg-emerald-50 text-[9px] font-bold text-emerald-600">
              ✓
            </div>

            <div>
              <strong className="block text-[9px] font-semibold text-gray-600">
                Secure access
              </strong>

              <span className="mt-[3px] block text-[8px] leading-relaxed text-zinc-400">
                Your account is protected by Supabase authentication.
              </span>
            </div>
          </div>

          {/* FOOTER */}
          <div className="mt-7 text-center text-[8px] text-[#c0c4ca]">
            CRM Management System
          </div>

        </div>
      </main>
    </div>
  );
}
