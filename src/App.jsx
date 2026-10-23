import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom"

const Login = lazy(() => import("./pages/Login"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Leads = lazy(() => import("./pages/Leads"))
const LeadDetail = lazy(() => import("./pages/LeadDetail"))
const Pipeline = lazy(() => import("./pages/Pipeline"))
const Tasks = lazy(() => import("./pages/Tasks"))
const TeamMembers = lazy(() => import("./pages/TeamMembers"))
const TeamMemberDetail = lazy(() => import("./pages/TeamMemberDetail"))
const TeamMemberDashboard = lazy(() => import("./pages/TeamMemberDashboard"))
const LandingPage = lazy(() => import("./pages/LandingPage"))
const MarketingAnalytics = lazy(() => import("./pages/MarketingAnalytics"))

function LegacyLeadDetailRedirect() {
  const { id } = useParams()
  return <Navigate to={`/lead/${id}`} replace />
}

import ProtectedRoute from "./components/ProtectedRoute"
import AdminRoute from "./components/AdminRoute"
import TeamMemberRoute from "./components/TeamMemberRoute"
import CRMLayout from "./components/CRMLayout"

function App() {
  return (
    <BrowserRouter>

      <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#f7f8fa] text-sm text-slate-500">Loading page…</div>}>
      <Routes>

        {/* =========================
            PUBLIC ROUTES
        ========================== */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route path="/landing" element={<LandingPage />} />


        {/* =========================
            PROTECTED CRM ROUTES
        ========================== */}

        <Route
          element={
            <ProtectedRoute>
              <CRMLayout />
            </ProtectedRoute>
          }
        >

          {/* DASHBOARD */}
          <Route
            path="/"
            element={<AdminRoute><Dashboard /></AdminRoute>}
          />

          <Route path="/my-dashboard" element={<TeamMemberRoute><TeamMemberDashboard /></TeamMemberRoute>} />
          <Route path="/marketing" element={<AdminRoute><MarketingAnalytics /></AdminRoute>} />


          {/* LEADS */}
          <Route
            path="/leads"
            element={<AdminRoute><Leads /></AdminRoute>}
          />
          <Route path="/clients" element={<Navigate to="/leads" replace />} />
          <Route path="/client" element={<Navigate to="/leads" replace />} />


          {/* LEAD DETAIL */}
          <Route
            path="/lead/:id"
            element={<LeadDetail />}
          />
          <Route path="/client/:id" element={<LegacyLeadDetailRedirect />} />


          {/* PIPELINE */}
          <Route
            path="/pipeline"
            element={<AdminRoute><Pipeline /></AdminRoute>}
          />


          {/* TASKS */}
          <Route
            path="/tasks"
            element={<AdminRoute><Tasks /></AdminRoute>}
          />


          {/* TEAM MEMBERS */}
          <Route
            path="/team-members"
            element={
              <AdminRoute>
                <TeamMembers />
              </AdminRoute>
            }
          />


          {/* TEAM MEMBER DETAIL */}
          <Route
            path="/team-member/:id"
            element={
              <AdminRoute>
                <TeamMemberDetail />
              </AdminRoute>
            }
          />

        </Route>

      </Routes>
      </Suspense>

    </BrowserRouter>
  )
}

export default App
