import { useState, useEffect } from "react";

function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStudents() {
      try {
        const token = sessionStorage.getItem("adminToken");
        const response = await fetch("http://localhost:3001/api/students", {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not load students.");
        }

        setStudents(Array.isArray(data) ? data : data.students || []);
      } catch (err) {
        setError(err.message || "Could not connect to the backend.");
      } finally {
        setLoading(false);
      }
    }

    loadStudents();
  }, []);

  if (loading) {
    return <p>Loading registered students...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <div>
      <h1>Registered Students</h1>

      {students.length === 0 ? (
        <p>No registered students found.</p>
      ) : (
        students.map((student) => (
          <p key={student.id}>
            {student.name} — Roll No: {student.rollNumber}
          </p>
        ))
      )}
    </div>
  );
}

export default Students;
