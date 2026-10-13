import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()

    if (!email || !password) {
      alert("Please enter email and password")
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    // Check user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", data.user.id)
      .single()

    if (profileError || !profile) {
      alert("User profile not found")
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    console.log("Logged in user:", profile)

    navigate("/")
  }

  return (
    <div className="login-page">

      {/* =========================
          LEFT BRAND SECTION
      ========================= */}

      <div className="login-brand">

        <div className="brand-content">

          <div className="brand-logo">
            C
          </div>

          <h1>
            Manage your business.
            <br />
            <span>Grow your relationships.</span>
          </h1>

          <p>
            A smarter way to manage clients, tasks,
            team members and your complete sales pipeline.
          </p>


          {/* FEATURES */}

          <div className="feature-list">

            <div className="feature-item">

              <div className="feature-icon">
                ✓
              </div>

              <div>
                <strong>Client Management</strong>
                <span>
                  Keep every client organized in one place.
                </span>
              </div>

            </div>


            <div className="feature-item">

              <div className="feature-icon">
                ✓
              </div>

              <div>
                <strong>Team Collaboration</strong>
                <span>
                  Assign clients and follow-ups to your team.
                </span>
              </div>

            </div>


            <div className="feature-item">

              <div className="feature-icon">
                ✓
              </div>

              <div>
                <strong>Sales Pipeline</strong>
                <span>
                  Track every opportunity from start to finish.
                </span>
              </div>

            </div>

          </div>

        </div>


        <div className="brand-footer">
          © {new Date().getFullYear()} CRM Management System
        </div>

      </div>


      {/* =========================
          RIGHT LOGIN SECTION
      ========================= */}

      <div className="login-section">

        <div className="login-card">

          {/* MOBILE LOGO */}

          <div className="mobile-logo">
            <div className="mobile-logo-mark">
              C
            </div>

            <div>
              <strong>CRM</strong>
              <span>Management System</span>
            </div>
          </div>


          {/* HEADER */}

          <div className="login-header">

            <div className="welcome-icon">
              →
            </div>

            <h2>
              Welcome back
            </h2>

            <p>
              Sign in to continue to your CRM dashboard.
            </p>

          </div>


          {/* FORM */}

          <form onSubmit={handleLogin}>

            {/* EMAIL */}

            <div className="form-group">

              <label>
                Email Address
              </label>

              <div className="input-box">

                <span className="input-icon">
                  @
                </span>

                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  autoComplete="email"
                />

              </div>

            </div>


            {/* PASSWORD */}

            <div className="form-group">

              <div className="password-label">

                <label>
                  Password
                </label>

                <button
                  type="button"
                  className="forgot-btn"
                  onClick={() =>
                    alert(
                      "Please contact your administrator to reset your password."
                    )
                  }
                >
                  Forgot password?
                </button>

              </div>


              <div className="input-box">

                <span className="input-icon">
                  •
                </span>

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>

              </div>

            </div>


            {/* LOGIN BUTTON */}

            <button
              type="submit"
              className="login-btn"
              disabled={loading}
            >

              {loading ? (
                <>
                  <span className="spinner"></span>
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <span className="arrow">→</span>
                </>
              )}

            </button>

          </form>


          {/* SECURITY INFO */}

          <div className="security-info">

            <div className="lock-icon">
              ✓
            </div>

            <div>
              <strong>Secure access</strong>

              <span>
                Your account is protected by Supabase authentication.
              </span>
            </div>

          </div>


          <div className="login-footer">
            CRM Management System
          </div>

        </div>

      </div>


      {/* =========================
          CSS
      ========================= */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        .login-page {
          min-height: 100vh;

          display: flex;

          background: #f7f8fa;

          color: #111827;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }


        /* =========================
           LEFT BRAND
        ========================= */

        .login-brand {
          width: 48%;

          position: relative;

          display: flex;
          flex-direction: column;

          justify-content: space-between;

          padding: 55px 65px;

          overflow: hidden;

          background: #111827;
          color: white;
        }

        .login-brand::before {
          content: "";

          position: absolute;

          width: 420px;
          height: 420px;

          right: -170px;
          top: -170px;

          border-radius: 50%;

          border: 1px solid rgba(255,255,255,.07);
        }

        .login-brand::after {
          content: "";

          position: absolute;

          width: 600px;
          height: 600px;

          left: -350px;
          bottom: -350px;

          border-radius: 50%;

          border: 1px solid rgba(255,255,255,.05);
        }

        .brand-content {
          position: relative;
          z-index: 2;

          max-width: 500px;
        }


        /* LOGO */

        .brand-logo {
          width: 46px;
          height: 46px;

          display: flex;
          align-items: center;
          justify-content: center;

          margin-bottom: 60px;

          border-radius: 12px;

          background: white;
          color: #111827;

          font-size: 20px;
          font-weight: 800;
        }


        /* HEADING */

        .brand-content h1 {
          margin: 0;

          font-size: clamp(32px, 3.4vw, 50px);

          line-height: 1.08;

          letter-spacing: -1.7px;

          font-weight: 700;
        }

        .brand-content h1 span {
          color: #9ca3af;
        }

        .brand-content > p {
          max-width: 430px;

          margin: 22px 0 0;

          color: #9ca3af;

          font-size: 13px;
          line-height: 1.7;
        }


        /* FEATURES */

        .feature-list {
          margin-top: 48px;

          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .feature-icon {
          width: 27px;
          height: 27px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border: 1px solid rgba(255,255,255,.13);

          border-radius: 7px;

          color: #d1d5db;

          font-size: 10px;
        }

        .feature-item strong {
          display: block;

          color: #f9fafb;

          font-size: 11px;
          font-weight: 600;
        }

        .feature-item span {
          display: block;

          margin-top: 4px;

          color: #6b7280;

          font-size: 9px;
          line-height: 1.5;
        }


        /* FOOTER */

        .brand-footer {
          position: relative;
          z-index: 2;

          color: #4b5563;

          font-size: 9px;
        }


        /* =========================
           RIGHT LOGIN
        ========================= */

        .login-section {
          flex: 1;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 40px;
        }

        .login-card {
          width: 100%;
          max-width: 390px;
        }


        /* MOBILE LOGO */

        .mobile-logo {
          display: none;
        }


        /* HEADER */

        .login-header {
          margin-bottom: 29px;
        }

        .welcome-icon {
          width: 37px;
          height: 37px;

          display: flex;
          align-items: center;
          justify-content: center;

          margin-bottom: 17px;

          border-radius: 9px;

          background: #111827;
          color: white;

          font-size: 18px;
        }

        .login-header h2 {
          margin: 0;

          color: #111827;

          font-size: 27px;
          font-weight: 700;

          letter-spacing: -0.7px;
        }

        .login-header p {
          margin: 7px 0 0;

          color: #9ca3af;

          font-size: 11px;
          line-height: 1.5;
        }


        /* =========================
           FORM
        ========================= */

        .form-group {
          margin-bottom: 18px;
        }

        .form-group label {
          display: block;

          margin-bottom: 7px;

          color: #374151;

          font-size: 10px;
          font-weight: 650;
        }

        .password-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .password-label label {
          margin-bottom: 7px;
        }

        .forgot-btn {
          margin-bottom: 7px;

          padding: 0;

          border: none;
          background: transparent;

          color: #6b7280;

          font-size: 9px;
          font-weight: 500;

          cursor: pointer;
        }

        .forgot-btn:hover {
          color: #111827;
          text-decoration: underline;
        }

        .input-box {
          height: 45px;

          display: flex;
          align-items: center;

          border: 1px solid #e1e4e8;
          border-radius: 8px;

          background: white;

          transition:
            border-color .2s ease,
            box-shadow .2s ease;
        }

        .input-box:focus-within {
          border-color: #9ca3af;

          box-shadow:
            0 0 0 3px rgba(17,24,39,.045);
        }

        .input-icon {
          width: 38px;

          display: flex;
          align-items: center;
          justify-content: center;

          color: #a1a1aa;

          font-size: 14px;
        }

        .input-box input {
          flex: 1;

          height: 100%;

          padding: 0 8px 0 0;

          border: none;
          outline: none;

          background: transparent;

          color: #111827;

          font-size: 11px;
        }

        .input-box input::placeholder {
          color: #b1b5bc;
        }

        .password-toggle {
          margin-right: 8px;

          padding: 5px 6px;

          border: none;

          background: transparent;

          color: #9ca3af;

          font-size: 8px;
          font-weight: 600;

          cursor: pointer;
        }

        .password-toggle:hover {
          color: #374151;
        }


        /* =========================
           LOGIN BUTTON
        ========================= */

        .login-btn {
          width: 100%;
          height: 45px;

          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;

          margin-top: 25px;

          border: none;
          border-radius: 8px;

          background: #111827;
          color: white;

          font-size: 11px;
          font-weight: 650;

          cursor: pointer;

          transition:
            background .2s ease,
            transform .2s ease;
        }

        .login-btn:hover:not(:disabled) {
          background: #1f2937;

          transform: translateY(-1px);
        }

        .login-btn:disabled {
          opacity: .65;
          cursor: not-allowed;
        }

        .arrow {
          font-size: 15px;
        }

        .spinner {
          width: 13px;
          height: 13px;

          border: 2px solid rgba(255,255,255,.3);

          border-top-color: white;

          border-radius: 50%;

          animation: loginSpin .7s linear infinite;
        }

        @keyframes loginSpin {
          to {
            transform: rotate(360deg);
          }
        }


        /* =========================
           SECURITY
        ========================= */

        .security-info {
          display: flex;
          align-items: flex-start;
          gap: 9px;

          margin-top: 22px;
          padding: 12px;

          border: 1px solid #eef0f2;
          border-radius: 8px;

          background: #fafafa;
        }

        .lock-icon {
          width: 23px;
          height: 23px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex-shrink: 0;

          border-radius: 6px;

          background: #ecfdf5;
          color: #059669;

          font-size: 9px;
          font-weight: 700;
        }

        .security-info strong {
          display: block;

          color: #4b5563;

          font-size: 9px;
          font-weight: 600;
        }

        .security-info span {
          display: block;

          margin-top: 3px;

          color: #a1a1aa;

          font-size: 8px;
          line-height: 1.4;
        }


        /* =========================
           FOOTER
        ========================= */

        .login-footer {
          margin-top: 28px;

          text-align: center;

          color: #c0c4ca;

          font-size: 8px;
        }


        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 900px) {

          .login-brand {
            width: 42%;

            padding: 40px;
          }

          .brand-content h1 {
            font-size: 34px;
          }

          .brand-logo {
            margin-bottom: 45px;
          }

          .feature-list {
            margin-top: 35px;
          }

        }


        @media (max-width: 700px) {

          .login-page {
            min-height: 100vh;
            display: block;
          }

          .login-brand {
            display: none;
          }

          .login-section {
            min-height: 100vh;

            padding: 30px 20px;
          }

          .login-card {
            max-width: 420px;
          }

          .mobile-logo {
            display: flex;
            align-items: center;
            gap: 9px;

            margin-bottom: 50px;
          }

          .mobile-logo-mark {
            width: 35px;
            height: 35px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 9px;

            background: #111827;
            color: white;

            font-size: 15px;
            font-weight: 700;
          }

          .mobile-logo strong {
            display: block;

            color: #111827;

            font-size: 13px;
          }

          .mobile-logo span {
            display: block;

            margin-top: 2px;

            color: #9ca3af;

            font-size: 7px;
          }

        }


        @media (max-width: 400px) {

          .login-section {
            padding: 25px 16px;
          }

          .mobile-logo {
            margin-bottom: 40px;
          }

          .login-header h2 {
            font-size: 24px;
          }

        }

      `}</style>

    </div>
  )
}