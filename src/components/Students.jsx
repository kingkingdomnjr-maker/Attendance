import { useState, useEffect } from "react";
import API_URL from "../api";
import "./Student.css";

function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStudents() {
      try {
        const token = sessionStorage.getItem("adminToken");
        const response = await fetch(`${API_URL}/api/students`, {
          headers: {
            ...(token ? { Authorization: "Bearer " + token } : {}),
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
  <div className="students-page">
    <h1>Registered Students</h1>

    {students.length === 0 ? (
      <p className="students-message">No registered students found.</p>
    ) : (
      <div className="students-list">
        {students.map((student) => (
          <div className="student-item" key={student.id}>
            <h3>{student.name}</h3>
            <p>Roll No: {student.rollNumber}</p>
          </div>
        ))}
      </div>
    )}
  </div>
); }

export default Students;
