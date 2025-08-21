// remediator.js
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

app.post("/alerts", (req, res) => {
  console.log("🚨 Incoming Alert:");
  console.log(JSON.stringify(req.body, null, 2));

  // Example remediation logic
  req.body.alerts.forEach((alert) => {
    if (alert.labels.alertname === "HighCpuUsage") {
      console.log("🛠 Remediation: Restarting service due to high CPU...");
      // Here you can call Docker, Kubernetes, or any script to fix the issue
    } else if (alert.labels.alertname === "InstanceDown") {
      console.log("🛠 Remediation: Restarting instance...");
      // Add your restart logic here
    } else {
      console.log("⚡ No remediation defined for this alert.");
    }
  });

  res.status(200).send("Alert received");
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`✅ Remediator listening on port ${PORT}`);
});