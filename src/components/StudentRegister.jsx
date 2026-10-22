import { useState } from "react";

function StudentRegister() {
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleRegister(event) {
  event.preventDefault();

  setMessage("");
  setError("");
  setLoading(true);

  try {
    const response = await fetch(
      "http://192.168.137.1:3001/api/students/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          rollNumber,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Registration failed.");
    }

    setMessage(data.message);
    setName("");
    setRollNumber("");
  } catch (error) {
    setError(error.message || "Could not connect to the backend.");
  } finally {
    setLoading(false);
  }
}

  return (
    <div>
      <h2>Student Registration</h2>

      <form onSubmit={handleRegister}>
        <div>
          <label htmlFor="name">Student Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="rollNumber">Roll Number</label>
          <input
            id="rollNumber"
            type="text"
            value={rollNumber}
            onChange={(event) => setRollNumber(event.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      {message && <p>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default StudentRegister;