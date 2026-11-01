const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "attendance.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("SQLite database connected successfully.");

module.exports = db;