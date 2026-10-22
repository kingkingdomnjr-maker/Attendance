

const fs = require("fs");
const path = require("path");
const db = require("./database");

const studentsFile = path.join(__dirname, "students.json");
const attendanceFile = path.join(__dirname, "attendance.json");

const students = JSON.parse(
  fs.readFileSync(studentsFile, "utf8")
);

const records = JSON.parse(
  fs.readFileSync(attendanceFile, "utf8")
);

const migrate = db.transaction(() => {
  const insertStudent = db.prepare(`
    INSERT OR IGNORE INTO students
    (id, name, rollNumber, macAddress)
    VALUES (?, ?, ?, ?)
  `);

  for (const student of students) {
    insertStudent.run(
      String(student.id),
      student.name,
      String(student.rollNumber),
      student.macAddress || null
    );
  }

  const insertSession = db.prepare(`
    INSERT OR IGNORE INTO sessions
    (startedAt, endsAt, active)
    VALUES (?, ?, 0)
  `);

  const insertAttendance = db.prepare(`
    INSERT OR IGNORE INTO attendance
    (studentId, sessionStartedAt, date, status, markedAt)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const record of records) {
    const sessionStartedAt = String(record.sessionStartedAt);

    insertSession.run(
      sessionStartedAt,
      null
    );

    insertAttendance.run(
      String(record.studentId),
      sessionStartedAt,
      record.date,
      record.status,
      record.markedAt
    );
  }
});

try {
  migrate();
  console.log("Migration completed successfully!");

  console.log(
    "Students in database:",
    db.prepare("SELECT COUNT(*) AS count FROM students").get().count
  );

  console.log(
    "Attendance records in database:",
    db.prepare("SELECT COUNT(*) AS count FROM attendance").get().count
  );
} catch (error) {
  console.error("Migration failed:", error.message);
} finally {
  db.close();
}
