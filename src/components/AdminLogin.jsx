
import { useState } from "react";
import API_URL from "../api";
import "./AdminLogin.css";

function AdminLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/admin/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      onLoginSuccess(data.token);
    } catch (error) {
      setError(
        error instanceof TypeError
          ? import.meta.env.DEV && !import.meta.env.VITE_API_URL
            ? "This is the local development site, but its API is not running. Open your Render site, or set VITE_API_URL in the repository-root .env.local to your Render service URL."
            : `Could not reach the API at ${
                API_URL || window.location.origin
              }. Check the Render deployment and its service logs.`
          : error.message || "Could not connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-background"></div>

      <div className="login-card">
        <div className="login-logo">
          <span>SDC</span>
        </div>

        <p className="login-tag">ADMINISTRATOR PORTAL</p>

        <h1>Welcome back</h1>

        <p className="login-description">
          Sign in to manage attendance and student records.
        </p>

        <form onSubmit={handleLogin}>
          <div className="login-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && (
            <p className="login-error">{error}</p>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
            <span>→</span>
          </button>
        </form>

        <p className="login-footer">
          Skill Development Club · CUCEK
        </p>
      </div>
    </div>
  );
}

export default AdminLogin;
