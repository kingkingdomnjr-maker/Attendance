
import { useEffect, useState } from "react";
import "./StudentRegister.css";

const API_URL = "http://192.168.137.1:3001";

function StudentRegister() {
  const [name, setName] = useState("");
  const [devices, setDevices] = useState([]);
  const [selectedMacAddress, setSelectedMacAddress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [registeredStudent, setRegisteredStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);

  async function loadDevices() {
    setDetecting(true);
    setError("");
    setSessionUnavailable(false);

    try {
      const response = await fetch(
        `${API_URL}/api/registration/devices`
      );
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setSessionUnavailable(true);
        }
        throw new Error(data.message || "Could not load devices.");
      }

      setDevices(data.clients || []);
      setSelectedMacAddress((current) =>
        (data.clients || []).some(
          (device) => device.macAddress === current
        )
          ? current
          : ""
      );
    } catch (err) {
      setError(err.message || "Could not connect to the backend.");
      setDevices([]);
    } finally {
      setDetecting(false);
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  async function handleRegister(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setRegisteredStudent(null);

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!selectedMacAddress) {
      setError("Please select your connected phone.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/students/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            macAddress: selectedMacAddress,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setSessionUnavailable(true);
        }
        throw new Error(data.message || "Registration failed.");
      }

      setRegisteredStudent(data.student);
      setMessage(data.message || "Registration successful!");
      setName("");
      setSelectedMacAddress("");
      await loadDevices();
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  function getDeviceName(device) {
    return (
      device.hostNames?.filter(Boolean).join(", ") ||
      "Unknown device"
    );
  }

  if (registeredStudent) {
    return (
      <main className="registration-page">
        <section className="registration-card success-card">
          <div className="success-icon">✓</div>
          <h1>Registration complete!</h1>
          <p>{registeredStudent.name}, you have been registered successfully.</p>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setRegisteredStudent(null);
              setMessage("");
              setError("");
              loadDevices();
            }}
          >
            Done
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-page">
      <section className="registration-card">
        <header className="registration-header">
          <p className="club-label">SKILL DEVELOPMENT CLUB</p>
          <h1>Student Registration</h1>
          <p>Register your details and link your connected phone.</p>
        </header>

        {sessionUnavailable ? (
          <div className="status-message error-message">
            Registration is unavailable. Please wait for the admin to start a session.
          </div>
        ) : (
          <>
            <div className="connection-notice">
              Connect your phone to the admin's hotspot before continuing.
            </div>

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="student-name">Full name</label>
                <input
                  id="student-name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="device-heading">
                <div>
                  <h2>Select your phone</h2>
                  <p>Choose the device you are using right now.</p>
                </div>

                <button
                  type="button"
                  className="refresh-button"
                  onClick={loadDevices}
                  disabled={detecting || loading}
                >
                  {detecting ? "Scanning..." : "Refresh"}
                </button>
              </div>

              {devices.length === 0 ? (
                <div className="empty-devices">
                  <p>{detecting ? "Searching for connected phones..." : "No phones detected."}</p>
                  <p>Connect to the hotspot and refresh the list.</p>
                </div>
              ) : (
                <div className="device-list">
                  {devices.map((device, index) => (
                    <label
                      key={device.macAddress || index}
                      className={`device-option ${
                        selectedMacAddress === device.macAddress
                          ? "selected"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="device"
                        value={device.macAddress || ""}
                        checked={
                          selectedMacAddress === device.macAddress
                        }
                        onChange={() =>
                          setSelectedMacAddress(device.macAddress || "")
                        }
                        disabled={!device.macAddress || loading}
                        required
                      />

                      <span className="phone-icon">▯</span>

                      <span className="device-details">
                        <strong>{getDeviceName(device)}</strong>
                        <small>
                          {device.macAddress || "Device address unavailable"}
                        </small>
                      </span>

                      <span className="device-check">
                        {selectedMacAddress === device.macAddress ? "✓" : ""}
                      </span>
                    </label>
                  ))}
                </div>
              )}

            

              {message && (
                <div className="status-message success-message">
                  {message}
                </div>
              )}

              {error && (
                <div className="status-message error-message">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={
                  loading ||
                  detecting ||
                  devices.length === 0 ||
                  !selectedMacAddress
                }
              >
                {loading ? "Registering..." : "Complete registration"}
              </button>
            </form>
          </>
        )}

        {sessionUnavailable && error && (
          <p className="status-message error-message">{error}</p>
        )}
      </section>
    </main>
  );
}

export default StudentRegister;
