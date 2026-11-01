const Database = require("better-sqlite3");
const { Pool } = require("pg");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const sqlite = new Database(
  path.join(__dirname, "attendance.db"),
  { readonly: true }
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function migrate() {
  const client = await pool.connect();

  try {
    // Read all existing SQLite data
    const students = sqlite.prepare(
      "SELECT * FROM students"
    ).all();

    const sessions = sqlite.prepare(
      "SELECT * FROM sessions"
    ).all();

    const attendance = sqlite.prepare(
      "SELECT * FROM attendance"
    ).all();

    console.log("SQLite data loaded:");
    console.log("Students:", students.length);
    console.log("Sessions:", sessions.length);
    console.log("Attendance:", attendance.length);

    await client.query("BEGIN");

    // Migrate students
    for (const student of students) {
      await client.query(
        `INSERT INTO students
         (id, name, "rollNumber", "macAddress")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [
          String(student.id),
          student.name,
          String(student.rollNumber),
          student.macAddress || null,
        ]
      );
    }

    // Migrate sessions
    for (const session of sessions) {
      await client.query(
        `INSERT INTO sessions
         (id, "startedAt", "endsAt", active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [
          String(session.id),
          String(session.startedAt),
          session.endsAt === null ? null : String(session.endsAt),
          Boolean(session.active),
        ]
      );
    }

    // Migrate attendance records
    for (const record of attendance) {
      await client.query(
        `INSERT INTO attendance
         (id, "studentId", "sessionStartedAt", date, status, "markedAt")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [
          String(record.id),
          String(record.studentId),
          String(record.sessionStartedAt),
          record.date,
          record.status,
          record.markedAt,
        ]
      );
    }

    // Reset PostgreSQL identity counters
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('sessions', 'id'),
        COALESCE((SELECT MAX(id) FROM sessions), 1),
        EXISTS(SELECT 1 FROM sessions)
      )
    `);

    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('attendance', 'id'),
        COALESCE((SELECT MAX(id) FROM attendance), 1),
        EXISTS(SELECT 1 FROM attendance)
      )
    `);

    await client.query("COMMIT");

    console.log("Migration completed successfully!");

    const result = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM students) AS students,
        (SELECT COUNT(*) FROM sessions) AS sessions,
        (SELECT COUNT(*) FROM attendance) AS attendance
    `);

    console.log("Supabase database totals:", result.rows[0]);

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error.message);
  } finally {
    client.release();
    sqlite.close();
    await pool.end();
  }
}

migrate();