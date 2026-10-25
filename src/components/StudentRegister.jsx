
import { useEffect, useState } from "react";

const API_URL = "http://192.168.137.1:3001";

function StudentRegister() {
  const [name, setName] = useState("");
  const [devices, setDevices] = useState([]);
  const [selectedMacAddress, setSelectedMacAddress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);

  async function loadDevices() {
    setDetecting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/registration/devices`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not load devices."
        );
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

    if (!selectedMacAddress) {
      setError("Please select your phone first.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/students/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            macAddress: selectedMacAddress,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Registration failed."
        );
      }

      setMessage(data.message);
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

  return (
    <div>
      <h2>Student Registration</h2>

      <p>
        Connect your phone to the admin's hotspot before registering.
      </p>

      <button
        type="button"
        onClick={loadDevices}
        disabled={detecting}
      >
        {detecting ? "Detecting..." : "Refresh devices"}
      </button>

      <form onSubmit={handleRegister}>
        <div>
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <h3>Select your phone</h3>

        {devices.length === 0 && (
          <p>No hotspot devices detected. Connect your phone and refresh.</p>
        )}

        {devices.map((device) => (
          <label
            key={device.macAddress}
            style={{ display: "block", margin: "12px 0" }}
          >
            <input
              type="radio"
              name="device"
              value={device.macAddress}
              checked={selectedMacAddress === device.macAddress}
              onChange={() =>
                setSelectedMacAddress(device.macAddress)
              }
              disabled={!device.macAddress}
              required
            />

            {" "}
            {getDeviceName(device)}
            {device.macAddress && ` (${device.macAddress})`}
          </label>
        ))}

        <button
          type="submit"
          disabled={loading || detecting || devices.length === 0}
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      {message && <p>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default StudentRegister;
