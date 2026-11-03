import { useRef, useState, useEffect } from "react";
import API_URL from "../api";
import "./AttendanceHistory.css";


function AttendanceHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const dateRefs = useRef({});

  function handleDateChange(event) {
  const date = event.target.value;

  setSelectedDate(date);

  const selectedSection = dateRefs.current[date];

  if (selectedSection) {
    selectedSection.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}
  useEffect(() => {
    async function loadHistory() {
      try {
        const token = sessionStorage.getItem("adminToken");
        const response = await fetch(`${API_URL}/api/attendance/history`, {
          headers: {
            ...(token ? { Authorization: "Bearer " + token } : {}),
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not load attendance history.");
        }

        setHistory(data.history || []);
      } catch (err) {
        setError(err.message || "Could not connect to the backend.");
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

 if (loading) {
  return <p className="history-message">Loading attendance history...</p>;
}

if (error) {
  return <p className="history-error">Error: {error}</p>;
}

 return (
  <div className="history-page">
    <div className="history-header">
  <h1>Attendance History</h1>

  <input
    type="date"
    value={selectedDate}
    onChange={handleDateChange}
    min={history.length > 0 ? history[history.length - 1].date : undefined}
    max={history.length > 0 ? history[0].date : undefined}
  />
</div>

    {history.length === 0 ? (
      <p className="history-message">No attendance history found.</p>
    ) : (
      history.map((day) => (
        <section
  className="history-day"
  key={day.date}
  ref={(element) => {
    dateRefs.current[day.date] = element;
  }}
>
          <h2>
            {new Date(`${day.date}T00:00:00`).toLocaleDateString()}
          </h2>

          {day.sessions.map((session) => (
            <div className="history-session" key={session.sessionStartedAt}>
             <h3 className="session-heading">
            <span> Session at{" "}
             {new Date(session.sessionStartedAt).toLocaleTimeString()}
            </span>

  <span className="session-present-count">
    {session.presentStudents.length} Present
  </span>
</h3>

              {session.presentStudents.length === 0 ? (
                <p className="history-message">
                  No students marked present.
                </p>
              ) : (
                session.presentStudents.map((student) => (
                  <div className="history-student" key={student.studentId}>
                    {student.name} — Roll No: {student.rollNumber} —{" "}
                    {student.status}
                  </div>
                ))
              )}
            </div>
          ))}
        </section>
      ))
    )}
  </div>
);
}

export default AttendanceHistory;
