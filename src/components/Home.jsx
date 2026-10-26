
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Home.css";

const API_URL = "http://192.168.137.1:3001";

function Home() {
  const [sessionActive, setSessionActive] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch(`${API_URL}/api/session`);

        if (!response.ok) {
          throw new Error("Could not check session");
        }

        const data = await response.json();

        const active = Boolean(
          data.active ||
          data.session?.active ||
          data.session?.startedAt ||
          data.startedAt
        );

        if (!cancelled) {
          setSessionActive(active);
          setStatusError(false);
        }
      } catch {
        if (!cancelled) {
          setStatusError(true);
        }
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    checkSession();

    const intervalId = setInterval(checkSession, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <main className="home-page">
      <section className="home-content">
        <header className="home-header">
          <p className="home-club-label">
            SKILL DEVELOPMENT CLUB
          </p>

          <h1>Attendance System</h1>

          <p className="home-subtitle">
            Welcome to the club attendance portal.
          </p>
        </header>

        <section
          className={`home-session-status ${
            sessionActive ? "session-active" : "session-inactive"
          }`}
        >
          <div className="session-status-heading">
            <span className="session-status-dot" />

            <strong>
              {checkingSession
                ? "Checking session..."
                : statusError
                ? "Session status unavailable"
                : sessionActive
                ? "Session active"
                : "Session inactive"}
            </strong>
          </div>

          <p>
            {checkingSession
              ? "Please wait while we check the current session."
              : statusError
              ? "Unable to check registration availability. Please try again shortly."
              : sessionActive
              ? "Registration is available now. Connect your phone to the admin's hotspot to register."
              : "Registration is currently unavailable. Please wait for the admin to start a session."}
          </p>
        </section>

        <div className="home-cards">
          <Link to="/register" className="home-card">
            <span className="home-card-icon">＋</span>

            <h2>Student Registration</h2>

            <p>
              Register your details and connect your phone.
            </p>

            <span className="home-card-action">
              Go to registration →
            </span>
          </Link>

          <Link to="/login" className="home-card">
            <span className="home-card-icon">↗</span>

            <h2>Admin Login</h2>

            <p>
              Manage sessions, registered students and attendance.
            </p>

            <span className="home-card-action">
              Admin login →
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Home;
