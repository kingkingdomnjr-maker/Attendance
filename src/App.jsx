import "./App.css";
import { useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
} from "react-router-dom";

import Dashboard from "./components/Dashboard";
import Students from "./components/Students";
import AdminLogin from "./components/AdminLogin";
import StudentRegister from "./components/StudentRegister";
import AttendanceHistory from "./components/AttendanceHistory";
import Home from "./components/Home";

function App() {
  const navigate = useNavigate();

  const [token, setToken] = useState(
    () => sessionStorage.getItem("adminToken") || ""
  );

  function handleLoginSuccess(newToken) {
    sessionStorage.setItem("adminToken", newToken);
    setToken(newToken);
    navigate("/dashboard", { replace: true });
  }

  function handleLogout() {
    sessionStorage.removeItem("adminToken");
    setToken("");
    navigate("/");
  }

  function AdminLayout({ children }) {
    return (
      <div className="app-layout">
        <aside className="sidebar">
          <h2 className="sidebar-title">
            SKILL Development Club
          </h2>

          <p className="sidebar-subtitle">
            Attendance System
          </p>
          <NavLink to="/" end className="sidebar-link">
            Home
          </NavLink>

          <nav className="sidebar-nav">
            <NavLink to="/dashboard" end className="sidebar-link">
              Dashboard
            </NavLink>

            <NavLink to="/students" className="sidebar-link">
              Registered Students
            </NavLink>

            <NavLink to="/history" className="sidebar-link">
              Attendance History
            </NavLink>
          </nav>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Admin Logout
          </button>
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/register"
        element={<StudentRegister />}
      />

      <Route
        path="/login"
        element={
          token ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AdminLogin
              onLoginSuccess={handleLoginSuccess}
            />
          )
        }
      />

      <Route path="/" element={<Home />} />
      <Route
        path="/students"
        element={
          token ? (
            <AdminLayout>
              <Students />
            </AdminLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
  path="/dashboard"
  element={
    token ? (
      <AdminLayout>
        <Dashboard />
      </AdminLayout>
    ) : (
      <Navigate to="/login" replace />
    )
  }
/>

      <Route
        path="/history"
        element={
          token ? (
            <AdminLayout>
              <AttendanceHistory />
            </AdminLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;