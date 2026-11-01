const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3002;

app.get("/devices", (req, res) => {
  execFile(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(__dirname, "detect-devices.ps1"),
    ],
    (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({
          error: stderr || error.message,
        });
      }

      try {
        res.json(JSON.parse(stdout));
      } catch {
        res.status(500).json({
          error: "Could not read detected devices.",
        });
      }
    }
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Local detection service running on port ${PORT}`);
});