import { useState, useEffect } from "react";

function AttendanceHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      try {
        const token = sessionStorage.getItem("adminToken");

        const response = await fetch(
          "http://localhost:3001/api/attendance/history",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Could not load attendance history."
          );
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
    return <p>Loading attendance history...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <div>
      <h1>Attendance History</h1>

      {history.length === 0 ? (
        <p>No attendance history found.</p>
      ) : (
        history.map((day) => (
          <section key={day.date}>
            <h2>
              {new Date(`${day.date}T00:00:00`).toLocaleDateString()}
            </h2>

            {day.sessions.map((session) => (
              <div key={session.sessionStartedAt}>
                <h3>
                  Session at{" "}
                  {new Date(
                    session.sessionStartedAt
                  ).toLocaleTimeString()}
                </h3>

                {session.presentStudents.length === 0 ? (
                  <p>No students marked present.</p>
                ) : (
                  session.presentStudents.map((student) => (
                    <p key={student.studentId}>
                      {student.name} — Roll No: {student.rollNumber}
                      {" — "}
                      {student.status}
                    </p>
                  ))
                )}

                <hr />
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

export default AttendanceHistory;