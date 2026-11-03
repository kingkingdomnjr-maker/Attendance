
const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const path = require("path");
const { promisify } = require("util");
const fs = require("fs");

const bcrypt = require("bcryptjs");
require("dotenv").config();
const crypto = require("crypto");
const {
  initializeDatabase,
  getStudents,
  createStudent,
  linkStudentDevice,
  getAttendanceRecords,
  getSessionStartedTimes,
  getActiveSession,
  createSession,
  finishSession,
  markStudentPresent,
} = require("./database");

const PORT = Number(process.env.PORT) || 3001;
const allowedOrigins = [
  /^https:\/\/.*\.onrender\.com$/,
  /^https:\/\/.*\.vercel\.app$/,
  /^http:\/\/localhost:517[3-9]$/,
  /^http:\/\/192\.168\.137\.1:517[3-9]$/,
  /^http:\/\/localhost:3000$/,
];

const app = express();
const runFile = promisify(execFile);


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
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.some((pattern) => pattern.test(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

const distPath = path.join(__dirname, "..", "dist");
const indexPath = path.join(distPath, "index.html");

app.use(express.static(distPath));

app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
  if (!fs.existsSync(indexPath)) {
    console.error("Frontend build is missing:", indexPath);
    return res.status(503).type("text").send(
      "The app frontend is not built. Check the Render build command."
    );
  }

  res.sendFile(indexPath, (error) => {
    if (error) {
      next(error);
    }
  });
});


app.post("/api/students/register", async (req, res) => {
  const session = getSessionStatus();

  if (!session) {
    return res.status(403).json({
      message: "Start an attendance session first.",
    });
  }

  const { name, macAddress } = req.body;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof macAddress !== "string" ||
    !macAddress.trim()
  ) {
    return res.status(400).json({
      message: "Name and device selection are required.",
    });
  }

  try {
    // Detect devices connected to the admin's hotspot.
    const scriptPath = path.join(__dirname, "detect-devices.ps1");

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
    const selectedMac = macAddress.trim().toLowerCase();

    const deviceIsConnected = (data.clients || []).some(
      (client) =>
        client.macAddress &&
        client.macAddress.trim().toLowerCase() === selectedMac
    );

    if (!deviceIsConnected) {
      return res.status(400).json({
        message: "Selected phone is not connected to the admin's hotspot. Refresh the device list.",
      });
    }

    const students = await getStudents();

    const alreadyRegistered = students.some(
      (student) =>
        student.macAddress &&
        student.macAddress.trim().toLowerCase() === selectedMac
    );

    if (alreadyRegistered) {
      return res.status(409).json({
        message: "This phone is already registered to a student.",
      });
    }

    // Generate the next available SDC roll number.
    let number = 1;
    let rollNumber;

    do {
      rollNumber = `SDC${String(number).padStart(3, "0")}`;
      number++;
    } while (
      students.some(
        (student) =>
          String(student.rollNumber).toUpperCase() === rollNumber
      )
    );

    const student = {
      id: crypto.randomUUID(),
      name: name.trim(),
      rollNumber,
      macAddress: selectedMac,
      registeredAt: new Date().toISOString(),
    };

    await createStudent(student);

    return res.status(201).json({
      message: `Registration successful! Your roll number is ${rollNumber}.`,
      student,
    });
  } catch (error) {
    console.error("Student registration failed:", error.message);

    return res.status(500).json({
      message: "Could not complete registration.",
    });
  }
});

app.get("/api/attendance", verifyAdmin, async (req, res) => {
  try {
    const records = await getAttendanceRecords();
    res.json({ records });
  } catch (error) {
    console.error("Could not load attendance:", error.message);

    res.status(500).json({
      message: "Could not load attendance records.",
    });
  }
});


app.get("/api/attendance/history", verifyAdmin, async (req, res) => {
  try {
    const sessionStartedTimes = await getSessionStartedTimes();
    const records = await getAttendanceRecords();
    const historyByDate = {};

    for (const startedAt of sessionStartedTimes) {
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
  } catch (error) {
    console.error("Could not load attendance history:", error.message);
    res.status(500).json({
      message: "Could not load attendance history.",
    });
  }
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
app.post("/api/session/start", verifyAdmin, async (req, res) => {
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
  try {
    await createSession(activeSession);
  } catch (error) {
    activeSession = null;
    console.error("Could not persist attendance session:", error.message);
    return res.status(500).json({
      message: "Could not start attendance session.",
    });
  }

  res.status(201).json({
    message: "Attendance session started.",
    session: activeSession,
  });
});
app.get("/api/registration/devices", async (req, res) => {
  const session = getSessionStatus();

  if (!session) {
    return res.status(403).json({
      message: "Start an attendance session first.",
    });
  }

  try {
    const scriptPath = path.join(__dirname, "detect-devices.ps1");

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

    res.json({
      clients: data.clients || [],
    });
  } catch (error) {
    console.error(
      "Registration device detection failed:",
      error.message
    );

    res.status(500).json({
      message: "Could not detect hotspot devices.",
    });
  }
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
app.post("/api/session/stop", verifyAdmin, async (req, res) => {
  if (!getSessionStatus()) {
    return res.json({
      message: "No active session.",
      active: false,
    });
  }

  const stoppedSession = activeSession;
  activeSession = null;

  try {
    await finishSession(stoppedSession.startedAt);
    res.json({
      message: "Attendance session stopped.",
      active: false,
    });
  } catch (error) {
    activeSession = stoppedSession;
    console.error("Could not persist session stop:", error.message);
    res.status(500).json({
      message: "Could not stop attendance session.",
    });
  }
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
const students = await getStudents();
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
    const wasMarked = await markStudentPresent(student, session);

    
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
app.get("/api/students", verifyAdmin, async (req, res) => {
  try {
    const students = await getStudents();
    res.json({ students });
  } catch (error) {
    console.error("Could not load students:", error.message);

    res.status(500).json({
      message: "Could not load registered students.",
    });
  }
});

app.post("/api/students/link-device", verifyAdmin, async (req, res) => {
  const { studentId, macAddress } = req.body;

  if (!studentId || !macAddress) {
    return res.status(400).json({
      message: "Student ID and MAC address are required.",
    });
  }

  try {
    const result = await linkStudentDevice(
      studentId,
      macAddress.trim().toLowerCase()
    );

    if (result.status === "not_found") {
      return res.status(404).json({
        message: "Student not found.",
      });
    }

    if (result.status === "conflict") {
      return res.status(409).json({
        message: "This device is already linked to another student.",
      });
    }

    return res.json({
      message: `Device linked successfully to ${result.student.name}.`,
      student: result.student,
    });
  } catch (error) {
    console.error("Error linking device:", error);

    return res.status(500).json({
      message: "Could not link device.",
    });
  }
});


async function startServer() {
  await initializeDatabase();
  activeSession = await getActiveSession();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Attendance backend running at http://localhost:${PORT}`
    );
  });
}

startServer().catch((error) => {
  console.error("Could not start the attendance server:", error.message);
  process.exitCode = 1;
});
