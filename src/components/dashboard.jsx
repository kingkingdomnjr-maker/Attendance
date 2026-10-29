import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

function Dashboard() {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [currentSessionStart, setCurrentSessionStart] = useState(null);
  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registeredStudents, setRegisteredStudents] = useState([]);

  async function fetchAttendance() {
    try {
      const token = sessionStorage.getItem("adminToken");
      const response = await fetch("http://localhost:3001/api/attendance", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

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
      const response = await fetch("http://localhost:3001/api/session");
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
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `The API ${endpoint} returned HTML or invalid JSON. Check the backend route.`
      );
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
      setSessionMessage(data.message);
    } catch (error) {
      setSessionMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  

  useEffect(() => {
    const token = sessionStorage.getItem("adminToken");

    if (token) {
      fetchAttendance();
      loadRegisteredStudents();
    }

    fetchCurrentSession();
  }, []);

  useEffect(() => {
  if (!sessionActive) {
    return;
  }

  const intervalId = setInterval(async () => {
    try {
      const data = await apiRequest("/api/devices");

      if (data.active) {
        await fetchAttendance();
      } else {
        setSessionActive(false);
        setDevices([]);
      }
    } catch (error) {
      console.error("Automatic device detection failed:", error.message);
    }
  }, 5000);

  return () => clearInterval(intervalId);
}, [sessionActive]);

  const totalStudents = registeredStudents.length;

  const presentStudents = new Set(
    attendanceRecords
      .filter(
        (record) =>
          String(record.status || "").toLowerCase() === "present" &&
          currentSessionStart !== null &&
          Number(record.sessionStartedAt) === Number(currentSessionStart)
      )
      .map((record) => record.studentId)
  ).size;

 const unmarkedStudents = currentSessionStart
  ? Math.max(0, totalStudents - presentStudents)
  : totalStudents;

const absentStudents = 0;
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

        <p>
          Session status: {sessionActive ? "Active" : "Not confirmed active"}
        </p>

        {sessionMessage && <p>{sessionMessage}</p>}

      
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
                String(record.status || "").toLowerCase() === "present" &&
                currentSessionStart !== null &&
                Number(record.sessionStartedAt) === Number(currentSessionStart)
            );

            return (
              <div className="student-card" key={student.id}>
                <h3>{student.name}</h3>

                <p>Roll Number: {student.rollNumber}</p>

                <p>
                  Attendance: {isPresent ? "Present" : currentSessionStart ? "Absent" : "No active session"}
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
