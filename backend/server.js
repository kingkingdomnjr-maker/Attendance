
const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const path = require("path");
const { promisify } = require("util");
const fs = require("fs");

const bcrypt = require("bcryptjs");
require("dotenv").config();
const crypto = require("crypto");
const db = require("./database");


const app = express();
const runFile = promisify(execFile);
const studentsFile = path.join(__dirname, "students.json");

const attendanceFile = path.join(__dirname, "attendance.json");

function readAttendance() {
  return db.prepare(`
    SELECT
      attendance.studentId,
      students.name,
      students.rollNumber,
      attendance.date,
      attendance.sessionStartedAt,
      attendance.status,
      attendance.markedAt
    FROM attendance
    JOIN students ON students.id = attendance.studentId
    ORDER BY attendance.id DESC
  `).all().map((record) => ({
    ...record,
    sessionStartedAt: Number(record.sessionStartedAt)
  }));
}

function saveAttendance(records) {
  const save = db.prepare(`
    INSERT OR IGNORE INTO attendance
    (studentId, sessionStartedAt, date, status, markedAt)
    VALUES (?, ?, ?, ?, ?)
  `);

  const saveAll = db.transaction((recordList) => {
    for (const record of recordList) {
      save.run(
        String(record.studentId),
        String(record.sessionStartedAt),
        record.date,
        record.status,
        record.markedAt
      );
    }
  });

  saveAll(records);
}
function markStudentPresent(student, session) {
  const alreadyMarked = db.prepare(`
    SELECT id
    FROM attendance
    WHERE studentId = ? AND sessionStartedAt = ?
  `).get(
    String(student.id),
    String(session.startedAt)
  );

  if (alreadyMarked) {
    return false;
  }

  db.prepare(`
    INSERT INTO attendance
    (studentId, sessionStartedAt, date, status, markedAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    String(student.id),
    String(session.startedAt),
    new Date(session.startedAt).toISOString().slice(0, 10),
    "Present",
    new Date().toISOString()
  );

  return true;
} 
function readStudents() {
  return db.prepare("SELECT * FROM students").all();
}

function saveStudents(students) {
  const save = db.prepare(`
    INSERT INTO students (id, name, rollNumber, macAddress)
    VALUES (@id, @name, @rollNumber, @macAddress)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      rollNumber = excluded.rollNumber,
      macAddress = excluded.macAddress
  `);

  const saveAll = db.transaction((studentList) => {
    for (const student of studentList) {
      save.run({
        id: String(student.id),
        name: student.name,
        rollNumber: String(student.rollNumber),
        macAddress: student.macAddress || null
      });
    }
  });

  saveAll(students);
}


const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminUsername || !adminPassword) {
  throw new Error("Admin credentials are missing from .env");
}
const adminPasswordHash = bcrypt.hashSync(adminPassword, 12);

const adminTokens = new Set();

function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Admin login required.",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!adminTokens.has(token)) {
    return res.status(401).json({
      message: "Invalid admin token.",
    });
  }

  next();
}


const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;

let activeSession = null;

app.use(
  cors({
    origin:  [
      /^http:\/\/localhost:517[3-9]$/,
      /^http:\/\/192\.168\.137\.1:517[3-9]$/,
    ],
  })
);

app.use(express.json());


app.post("/api/students/register", (req, res) => {
  const { name, rollNumber } = req.body;

  if (
    typeof name !== "string" ||
    typeof rollNumber !== "string" ||
    !name.trim() ||
    !rollNumber.trim() 
  ) {
    return res.status(400).json({
      message: "Name and roll number are required."
    });
  }

  const students = readStudents();

  const normalizedRollNumber = rollNumber.trim().toUpperCase();

  const duplicate = students.some(
    (student) =>
      student.rollNumber === normalizedRollNumber
  );

  if (duplicate) {
    return res.status(409).json({
      message: "This roll number is already registered.",
    });
  }

  const student = {
    id: crypto.randomUUID(),
    name: name.trim(),
    rollNumber: normalizedRollNumber,
    registeredAt: new Date().toISOString(),
  };

  students.push(student);
  saveStudents(students);

  res.status(201).json({
    message: "Student registered successfully.",
    student,
  });
});

app.get("/api/students", verifyAdmin, (req, res) => {
  const students = readStudents();

  res.json({ students });
});

app.get("/api/attendance", verifyAdmin, (req, res) => {
  const records = readAttendance();

  res.json({ records });
});

app.get("/api/attendance/history", verifyAdmin, (req, res) => {
  const sessions = db.prepare(`
    SELECT startedAt
    FROM sessions
    ORDER BY startedAt DESC
  `).all();

  const records = readAttendance();

  const historyByDate = {};

  for (const session of sessions) {
    const startedAt = Number(session.startedAt);
    const date = new Date(startedAt).toISOString().slice(0, 10);

    if (!historyByDate[date]) {
      historyByDate[date] = {};
    }

    historyByDate[date][String(startedAt)] = {
      sessionStartedAt: startedAt,
      presentStudents: [],
    };
  }

  for (const record of records) {
    const date = record.date;
    const sessionKey = String(record.sessionStartedAt);

    if (!historyByDate[date]) {
      historyByDate[date] = {};
    }

    if (!historyByDate[date][sessionKey]) {
      historyByDate[date][sessionKey] = {
        sessionStartedAt: record.sessionStartedAt,
        presentStudents: [],
      };
    }

    const session = historyByDate[date][sessionKey];

    if (
      !session.presentStudents.some(
        (student) => student.studentId === record.studentId
      )
    ) {
      session.presentStudents.push({
        studentId: record.studentId,
        name: record.name,
        rollNumber: record.rollNumber,
        status: record.status,
        markedAt: record.markedAt,
      });
    }
  }

  const history = Object.entries(historyByDate)
    .map(([date, sessionsByTime]) => ({
      date,
      sessions: Object.values(sessionsByTime),
      sessionCount: Object.keys(sessionsByTime).length,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  res.json({ history });
});



app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Username and password are required.",
      });
    }

    const usernameMatches =
      username === adminUsername;

    const passwordMatches =
      await bcrypt.compare(password, adminPasswordHash);

    if (!usernameMatches || !passwordMatches) {
      return res.status(401).json({
        message: "Invalid username or password.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    adminTokens.add(token);

    res.json({
      message: "Admin login successful.",
      token,
    });
  } catch (error) {
    console.error("Admin login failed:", error.message);

    res.status(500).json({
      message: "Could not process admin login.",
    });
  }
});

function getSessionStatus() {
  if (
    activeSession &&
    Date.now() >= activeSession.endsAt
  ) {
    activeSession = null;
  }

  return activeSession;
}

// 1. Start a new attendance session.
app.post("/api/session/start", verifyAdmin, (req, res) => {
  const existingSession = getSessionStatus();

  if (existingSession) {
    return res.json({
      message: "A session is already running.",
      session: existingSession,
    });
  }

  const startedAt = Date.now();

  activeSession = {
    startedAt,
    endsAt: startedAt + SESSION_DURATION_MS,
  };
  db.prepare(`
  INSERT INTO sessions (startedAt, endsAt, active)
  VALUES (?, ?, 1)
`).run(
  String(startedAt),
  new Date(startedAt + SESSION_DURATION_MS).toISOString()
);

  res.status(201).json({
    message: "Attendance session started.",
    session: activeSession,
  });
});

// 2. Check the current session.
app.get("/api/session", (req, res) => {
  const session = getSessionStatus();

  if (!session) {
    return res.json({
      active: false,
      session: null,
    });
  }

  res.json({
    active: true,
    session,
  });
});

// 3. Stop the session manually.
app.post("/api/session/stop", verifyAdmin, (req, res) => {
  if (!getSessionStatus()) {
    return res.json({
      message: "No active session.",
      active: false,
    });
  }

  activeSession = null;

  res.json({
    message: "Attendance session stopped.",
    active: false,
  });
});

// 4. Detect hotspot devices ONLY during an active session.
app.get("/api/devices", verifyAdmin, async (req, res) => {
  const session = getSessionStatus();

  if (!session) {
    return res.json({
      active: false,
      message: "Start an attendance session first.",
      clientCount: 0,
      clients: [],
    });
  }

  try {
    const scriptPath = path.join(
      __dirname,
      "detect-devices.ps1"
    );

    const { stdout } = await runFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
      ],
      {
        timeout: 15000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      }
    );

    
const data = JSON.parse(stdout.trim());

// Load registered students
const students = readStudents();
const markedStudents = [];

// Check each connected hotspot device
for (const client of data.clients || []) {
  if (!client.macAddress) {
    continue;
  }

  const deviceMac = client.macAddress.trim().toLowerCase();

  // Find the student linked to this device
  const student = students.find(
    (item) =>
      item.macAddress &&
      item.macAddress.trim().toLowerCase() === deviceMac
  );

  // Mark the student present if linked
  if (student) {
    const wasMarked = markStudentPresent(student, session);

    
    if (wasMarked) {
      markedStudents.push({
        name: student.name,
        rollNumber: student.rollNumber,
      });
    }
  }
}

res.json({
  active: true,
  ...data,
  markedStudents,
});
  } catch (error) {
    console.error(
      "Device detection failed:",
      error.message
    );

    res.status(500).json({
      error: "Could not retrieve hotspot clients.",
      details: error.message,
    });
  }
});

app.post("/api/students/link-device", verifyAdmin, (req, res) => {
  const { studentId, macAddress } = req.body;

  if (!studentId || !macAddress) {
    return res.status(400).json({
      message: "Student ID and MAC address are required.",
    });
  }

  try {
    const students = readStudents();

    const student = students.find(
      (item) => item.id === studentId
    );

    if (!student) {
      return res.status(404).json({
        message: "Student not found.",
      });
    }

    const existingStudent = students.find(
      (item) =>
        item.macAddress &&
        item.macAddress.toLowerCase() === macAddress.toLowerCase() &&
        item.id !== studentId
    );

    if (existingStudent) {
      return res.status(409).json({
        message: "This device is already linked to another student.",
      });
    }

    student.macAddress = macAddress.toLowerCase();

    saveStudents(students);

    return res.json({
      message: `Device linked successfully to ${student.name}.`,
      student,
    });
  } catch (error) {
    console.error("Error linking device:", error);

    return res.status(500).json({
      message: "Could not link device.",
    });
  }
});


app.listen(3001, "0.0.0.0", () => {
  console.log(
    "Attendance backend running at http://localhost:3001"
  );
});
