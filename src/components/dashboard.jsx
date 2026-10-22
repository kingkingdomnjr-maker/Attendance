
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

function Dashboard() {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [currentSessionStart, setCurrentSessionStart] = useState(null);

  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  async function fetchAttendance() {
    try {
      const token = sessionStorage.getItem("adminToken");

      const response = await fetch(
        "http://localhost:3001/api/attendance",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch attendance");
      }

      const data = await response.json();
      setAttendanceRecords(data.records || []);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  }

  async function fetchCurrentSession() {
    try {
      const response = await fetch(
        "http://localhost:3001/api/session"
      );

      const data = await response.json();

      if (data.active && data.session) {
        setCurrentSessionStart(data.session.startedAt);
        setSessionActive(true);
      } else {
        setCurrentSessionStart(null);
        setSessionActive(false);
      }
    } catch (error) {
      console.error("Error fetching current session:", error);
    }
  }

async function apiRequest(endpoint, method = "GET") {
  const token = sessionStorage.getItem("adminToken");

  const response = await fetch(`http://localhost:3001${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await response.text();

  console.log("API endpoint:", endpoint);
  console.log("Response status:", response.status);
  console.log("Response preview:", text.slice(0, 200));

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`The API ${endpoint} returned HTML or invalid JSON. Check the backend route.`);
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || "Request failed.");
  }

  return data;
}

  

  async function loadRegisteredStudents() {
    setLoading(true);
    setSessionMessage("");

    try {
      const data = await apiRequest("/api/students");
      setRegisteredStudents(data.students || []);
      setSessionMessage("Registered students loaded.");
    } catch (error) {
      setSessionMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function linkDevice(macAddress) {
    if (!selectedStudentId) {
      setSessionMessage("Please select a student first.");
      return;
    }

    setLoading(true);
    setSessionMessage("");

    try {
      const response = await fetch(
        "http://localhost:3001/api/students/link-device",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("adminToken")}`,
          },
          body: JSON.stringify({
            studentId: selectedStudentId,
            macAddress: macAddress,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Could not link device."
        );
      }

      setSessionMessage(result.message);
      await loadRegisteredStudents();
    } catch (error) {
      setSessionMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function startSession() {
    setLoading(true);
    setSessionMessage("");

    try {
      const data = await apiRequest("/api/session/start", "POST");

      setSessionActive(true);
      await fetchCurrentSession();
      await fetchAttendance();

      setSessionMessage(data.message);
    } catch (error) {
      setSessionMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function stopSession() {
    setLoading(true);
    setSessionMessage("");

    try {
      const data = await apiRequest("/api/session/stop", "POST");

      setSessionActive(false);
      setCurrentSessionStart(null);
      setDevices([]);

      setSessionMessage(data.message);
    } catch (error) {
      setSessionMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function detectDevices() {
    setLoading(true);
    setSessionMessage("");

    try {
      const data = await apiRequest("/api/devices");

      await fetchAttendance();
      await fetchCurrentSession();

      setSessionActive(data.active);

      if (data.active) {
        setDevices(data.clients || []);
        setSessionMessage(
          `Detected ${data.clientCount ?? data.clients?.length ?? 0} connected device(s).`
        );
      } else {
        setDevices([]);
        setSessionMessage(
          data.message || "Start an attendance session first."
        );
      }
    } catch (error) {
      setSessionMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAttendance();
    fetchCurrentSession();
    loadRegisteredStudents();
  }, []);

  const totalStudents = registeredStudents.length;

  const presentStudents = new Set(
    attendanceRecords
      .filter(
        (record) =>
          String(record.status || "").toLowerCase() === "present" &&
          currentSessionStart !== null &&
          Number(record.sessionStartedAt) ===
            Number(currentSessionStart)
      )
      .map((record) => record.studentId)
  ).size;

  const absentStudents = currentSessionStart
    ? Math.max(0, totalStudents - presentStudents)
    : 0;

  const unmarkedStudents = currentSessionStart
    ? 0
    : totalStudents;

  return (
    <div className="studentcard">
      <Link to="/students">Students</Link>

      <h2>SKILL Development Club</h2>
      <h1>Attendance System</h1>

      <section>
        <h2>Attendance Session</h2>

        <button onClick={startSession} disabled={loading}>
          Start Session
        </button>

        <button onClick={stopSession} disabled={loading}>
          Stop Session
        </button>

        <button onClick={detectDevices} disabled={loading}>
          Detect Devices
        </button>

        <p>
          Session status:{" "}
          {sessionActive ? "Active" : "Not confirmed active"}
        </p>

        {sessionMessage && <p>{sessionMessage}</p>}

        {devices.length > 0 && (
          <>
            <h3>Connected Hotspot Devices</h3>

            {devices.map((device, index) => (
              <div key={`${device.macAddress}-${index}`}>
                <p>
                  Device:{" "}
                  {device.hostNames?.join(", ") || "Unknown"}
                </p>

                <p>MAC address: {device.macAddress}</p>

                <button
                  onClick={() => linkDevice(device.macAddress)}
                  disabled={loading || !selectedStudentId}
                >
                  Link Device to Selected Student
                </button>
              </div>
            ))}
          </>
        )}

        <div>
          <button
            onClick={loadRegisteredStudents}
            disabled={loading}
          >
            Load Registered Students
          </button>

          {registeredStudents.length > 0 && (
            <div>
              <h3>Choose Student</h3>

              <select
                value={selectedStudentId}
                onChange={(event) =>
                  setSelectedStudentId(event.target.value)
                }
              >
                <option value="">Select a student</option>

                {registeredStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} - {student.rollNumber}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      <div className="summary-container">
        <div className="summary-card">
          <h3>Total Students</h3>
          <p>{totalStudents}</p>
        </div>

        <div className="summary-card">
          <h3>Present</h3>
          <p>{presentStudents}</p>
        </div>

        <div className="summary-card">
          <h3>Absent</h3>
          <p>{absentStudents}</p>
        </div>

        <div className="summary-card">
          <h3>Not Marked</h3>
          <p>{unmarkedStudents}</p>
        </div>
      </div>

      <h2>Registered Students & Attendance</h2>

      {registeredStudents.length === 0 ? (
        <p>No registered students found.</p>
      ) : (
        <div className="student-list">
          {registeredStudents.map((student) => {
            const isPresent = attendanceRecords.some(
              (record) =>
                record.studentId === student.id &&
                String(record.status || "").toLowerCase() ===
                  "present" &&
                currentSessionStart !== null &&
                Number(record.sessionStartedAt) ===
                  Number(currentSessionStart)
            );

            return (
              <div className="student-card" key={student.id}>
                <h3>{student.name}</h3>

                <p>Roll Number: {student.rollNumber}</p>

                <p>
                  Attendance:{" "}
                  {isPresent
                    ? "Present"
                    : currentSessionStart
                      ? "Absent"
                      : "No active session"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
