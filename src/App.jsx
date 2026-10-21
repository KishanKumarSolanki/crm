import { BrowserRouter, Routes, Route } from "react-router-dom"

import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Clients from "./pages/Clients"
import ClientDetail from "./pages/ClientDetail"
import Pipeline from "./pages/Pipeline"
import Tasks from "./pages/Tasks"
import TeamMembers from "./pages/TeamMembers"
import TeamMemberDetail from "./pages/TeamMemberDetail"
import TeamMemberDashboard from "./pages/TeamMemberDashboard"

import ProtectedRoute from "./components/ProtectedRoute"
import AdminRoute from "./components/AdminRoute"
import TeamMemberRoute from "./components/TeamMemberRoute"
import CRMLayout from "./components/CRMLayout"

function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* =========================
            PUBLIC ROUTES
        ========================== */}

        <Route
          path="/login"
          element={<Login />}
        />


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


          {/* CLIENTS */}
          <Route
            path="/clients"
            element={<AdminRoute><Clients /></AdminRoute>}
          />


          {/* CLIENT DETAIL */}
          <Route
            path="/client/:id"
            element={<ClientDetail />}
          />


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

    </BrowserRouter>
  )
}

export default App
