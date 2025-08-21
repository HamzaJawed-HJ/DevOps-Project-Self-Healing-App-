const express = require("express");
const client = require("prom-client");

const app = express();
const PORT = process.env.PORT || 3000;

// Prometheus metrics setup
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Custom counter for errors
const errorCounter = new client.Counter({
  name: "api_errors_total",
  help: "Total number of errors",
});

// Root route
app.get("/", (req, res) => {
  res.json({ message: "API is running! Try /api/hello, /metrics, /healthz" });
});

// Routes
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from API 🚀" });
});

app.get("/healthz", (req, res) => res.status(200).send("ok"));
app.get("/readyz", (req, res) => res.status(200).send("ready"));
app.get("/startupz", (req, res) => res.status(200).send("started"));

// Chaos endpoint for demo
app.get("/api/chaos", (req, res) => {
  if (req.query.crash === "true") {
    console.log("💥 Simulating crash!");
    process.exit(1);
  }

  if (req.query.errorRate) {
    const rate = parseFloat(req.query.errorRate);
    if (Math.random() < rate) {
      errorCounter.inc();
      return res.status(500).json({ error: "Chaos error injected" });
    }
  }

  res.json({ status: "chaos endpoint active" });
});

// Metrics
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});