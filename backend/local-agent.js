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
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  next();
});

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some((pattern) => pattern.test(origin))) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin is not allowed to access the local scanner."));
  },
  methods: ["GET"],
};

app.use(cors(corsOptions));
app.use(express.json());

const PORT = 3002;

app.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

let activeScan;

app.get("/devices", (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!activeScan) {
    activeScan = new Promise((resolve, reject) => {
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
            console.error(
              "Local hotspot scan failed:",
              stderr || error.message
            );
            reject(new Error(stderr?.trim() || error.message));
            return;
          }

          try {
            resolve(JSON.parse(stdout));
          } catch (parseError) {
            console.error(
              "Could not parse local hotspot scan:",
              parseError.message
            );
            reject(new Error("Could not read detected devices."));
          }
        }
      );
    }).finally(() => {
      activeScan = null;
    });
  }

  activeScan
    .then((result) => res.json(result))
    .catch((error) =>
      res.status(503).json({
        error: error.message,
      })
    );
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  console.error("Local scanner request failed:", error.message);
  res.status(403).json({ error: error.message });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Local detection service running on port ${PORT}`);
});