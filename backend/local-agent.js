const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const cors = require("cors");

const app = express();
const allowedOrigins = [
  /^https:\/\/.*\.onrender\.com$/,
  /^https:\/\/.*\.vercel\.app$/,
  /^http:\/\/localhost:(?:3000|517[3-9])$/,
];

app.use((req, res, next) => {
  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.some((pattern) => pattern.test(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed to access the local scanner."));
    },
    methods: ["GET"],
  })
);
app.use(express.json());

const PORT = 3002;

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/devices", (req, res) => {
  execFile(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(__dirname, "detect-devices.ps1"),
    ],
    {
      timeout: 15000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    },
    (error, stdout, stderr) => {
      if (error) {
        console.error("Local hotspot scan failed:", stderr || error.message);
        return res.status(503).json({
          error: stderr?.trim() || error.message,
        });
      }

      try {
        res.json(JSON.parse(stdout));
      } catch (parseError) {
        console.error("Could not parse local hotspot scan:", parseError.message);
        res.status(500).json({
          error: "Could not read detected devices.",
        });
      }
    }
  );
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Local detection service running on port ${PORT}`);
});