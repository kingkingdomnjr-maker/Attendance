const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to connect to the hosted database.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      "rollNumber" TEXT NOT NULL UNIQUE,
      "macAddress" TEXT,
      "registeredAt" TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      "startedAt" BIGINT NOT NULL UNIQUE,
      "endsAt" BIGINT,
      active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id BIGSERIAL PRIMARY KEY,
      "studentId" TEXT NOT NULL REFERENCES students(id),
      "sessionStartedAt" BIGINT NOT NULL REFERENCES sessions("startedAt"),
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      "markedAt" TEXT,
      UNIQUE ("studentId", "sessionStartedAt")
    );

    CREATE UNIQUE INDEX IF NOT EXISTS students_mac_address_unique
      ON students (LOWER("macAddress"))
      WHERE "macAddress" IS NOT NULL;
  `);
}

async function checkDatabase() {
  await pool.query("SELECT 1");
}

async function getStudents() {
  const { rows } = await pool.query(`
    SELECT id, name, "rollNumber", "macAddress", "registeredAt"
    FROM students
    ORDER BY "rollNumber"
  `);

  return rows;
}

async function createStudent(student) {
  await pool.query(
    `INSERT INTO students (id, name, "rollNumber", "macAddress", "registeredAt")
     VALUES ($1, $2, $3, $4, $5)`,
    [
      student.id,
      student.name,
      student.rollNumber,
      student.macAddress || null,
      student.registeredAt,
    ]
  );
}

async function linkStudentDevice(studentId, macAddress) {
  const existing = await pool.query(
    `SELECT id FROM students
     WHERE LOWER("macAddress") = LOWER($1) AND id <> $2`,
    [macAddress, studentId]
  );

  if (existing.rowCount > 0) {
    return { status: "conflict" };
  }

  const result = await pool.query(
    `UPDATE students SET "macAddress" = $1 WHERE id = $2
     RETURNING id, name, "rollNumber", "macAddress", "registeredAt"`,
    [macAddress, studentId]
  );

  return result.rowCount > 0
    ? { status: "updated", student: result.rows[0] }
    : { status: "not_found" };
}

async function getAttendanceRecords() {
  const { rows } = await pool.query(`
    SELECT
      attendance."studentId",
      students.name,
      students."rollNumber",
      attendance.date,
      attendance."sessionStartedAt",
      attendance.status,
      attendance."markedAt"
    FROM attendance
    JOIN students ON students.id = attendance."studentId"
    ORDER BY attendance.id DESC
  `);

  return rows.map((record) => ({
    ...record,
    sessionStartedAt: Number(record.sessionStartedAt),
  }));
}

async function getSessionStartedTimes() {
  const { rows } = await pool.query(
    `SELECT "startedAt" FROM sessions ORDER BY "startedAt" DESC`
  );

  return rows.map((row) => Number(row.startedAt));
}

async function getActiveSession() {
  const { rows } = await pool.query(
    `SELECT "startedAt", "endsAt"
     FROM sessions
     WHERE active = TRUE AND "endsAt" > $1
     ORDER BY "startedAt" DESC
     LIMIT 1`,
    [Date.now()]
  );

  if (rows.length === 0) {
    return null;
  }

  return {
    startedAt: Number(rows[0].startedAt),
    endsAt: Number(rows[0].endsAt),
  };
}

async function createSession(session) {
  await pool.query(
    `INSERT INTO sessions ("startedAt", "endsAt", active)
     VALUES ($1, $2, TRUE)`,
    [session.startedAt, session.endsAt]
  );
}

async function finishSession(startedAt) {
  await pool.query(
    `UPDATE sessions SET active = FALSE WHERE "startedAt" = $1`,
    [startedAt]
  );
}

async function markStudentPresent(student, session) {
  const result = await pool.query(
    `INSERT INTO attendance
       ("studentId", "sessionStartedAt", date, status, "markedAt")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("studentId", "sessionStartedAt") DO NOTHING
     RETURNING id`,
    [
      String(student.id),
      session.startedAt,
      new Date(session.startedAt).toISOString().slice(0, 10),
      "Present",
      new Date().toISOString(),
    ]
  );

  return result.rowCount > 0;
}

module.exports = {
  initializeDatabase,
  checkDatabase,
  getStudents,
  createStudent,
  linkStudentDevice,
  getAttendanceRecords,
  getSessionStartedTimes,
  getActiveSession,
  createSession,
  finishSession,
  markStudentPresent,
};
