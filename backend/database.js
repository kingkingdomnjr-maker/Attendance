
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "attendance.db");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create students table
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rollNumber TEXT NOT NULL UNIQUE,
    macAddress TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    startedAt TEXT NOT NULL UNIQUE,
    endsAt TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId TEXT NOT NULL,
    sessionStartedAt TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    markedAt TEXT,
    FOREIGN KEY (studentId) REFERENCES students(id),
    UNIQUE(studentId, sessionStartedAt)
  );
`);

console.log("SQLite database connected successfully.");
console.log("SQLite tables initialized successfully.");

module.exports = db;
