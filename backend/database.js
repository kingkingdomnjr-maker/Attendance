
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "attendance.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("SQLite database connected successfully.");

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rollNumber TEXT NOT NULL UNIQUE,
    macAddress TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    startedAt TEXT NOT NULL UNIQUE,
    endsAt TEXT,
    active INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId TEXT NOT NULL,
    sessionStartedAt TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    markedAt TEXT NOT NULL,
    FOREIGN KEY (studentId) REFERENCES students(id),
    FOREIGN KEY (sessionStartedAt) REFERENCES sessions(startedAt),
    UNIQUE (studentId, sessionStartedAt)
  );
`);


module.exports = db;
