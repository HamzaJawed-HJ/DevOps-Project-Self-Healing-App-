import express from 'express';
import Docker from 'dockerode';
import path from 'path';
import { fileURLToPath } from 'url';
import client from 'prom-client'; // <- add Prometheus client

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const app = express();
app.use(express.json());

// Path setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve dashboard static files
app.use(express.static(path.join(__dirname, 'dashboard')));

// Map alert names to target containers
const ACTIONS = {
  'TargetDown': ['api'],
  'ApiHighErrorRate': ['api']
};

// Label for auto-heal containers
const ALLOWED_LABEL = process.env.ALLOWED_LABEL || 'autoheal';

// Prometheus metrics
client.collectDefaultMetrics({ register: client.register });

// Custom metric: total remediator restarts
const remediatorRestarts = new client.Counter({
  name: 'remediator_restarts_total',
  help: 'Total number of container restarts performed by Remediator'
});

// Helper: restart container by name
async function restartByName(name) {
  const containers = await docker.listContainers({ all: true });
  const match = containers.find(c => c.Names.includes('/' + name));

  if (!match) {
    console.log(`❌ container ${name} not found`);
    return;
  }

  if (!match.Labels || match.Labels[ALLOWED_LABEL] !== 'true') {
    console.log(`⏭ skip ${name}: missing label ${ALLOWED_LABEL}=true`);
    return;
  }

  const container = docker.getContainer(match.Id);
  console.log(`🔄 Restarting ${name}...`);
  await container.restart();

  // Increment Prometheus counter
  remediatorRestarts.inc();
}

// Manual restart endpoint (for dashboard)
app.post('/restart/:container', async (req, res) => {
  const name = req.params.container;
  try {
    await restartByName(name);
    res.json({ ok: true });
  } catch (err) {
    console.error(err.message);
    res.json({ ok: false, error: err.message });
  }
});

// Webhook receiver from Alertmanager
app.post('/alerts', async (req, res) => {
  try {
    const alerts = req.body.alerts || [];
    for (const alert of alerts) {
      const alertName = alert.labels?.alertname;
      const targets = ACTIONS[alertName] || [];
      for (const t of targets) {
        try {
          await restartByName(t);
        } catch (err) {
          console.error(err.message);
        }
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('Error in /alerts handler:', e);
    res.status(500).send('error');
  }
});

// Health check auto-restart for unhealthy containers
const unhealthyCounts = new Map();

async function periodicHealthCheck() {
  try {
    const containers = await docker.listContainers({ all: true });
    for (const c of containers) {
      const name = c.Names?.[0]?.slice(1);
      if (!name) continue;

      const details = await docker.getContainer(c.Id).inspect();
      const status = details.State?.Health?.Status;

      if (status === 'unhealthy' && (c.Labels?.[ALLOWED_LABEL] === 'true')) {
        const count = (unhealthyCounts.get(name) || 0) + 1;
        unhealthyCounts.set(name, count);

        if (count >= 3) {
          console.log(`⚠️ Auto-restarting ${name}: unhealthy x${count}`);
          await docker.getContainer(c.Id).restart();
          unhealthyCounts.set(name, 0);

          // Increment Prometheus counter
          remediatorRestarts.inc();
        }
      } else {
        unhealthyCounts.set(name, 0);
      }
    }
  } catch (err) {
    console.error('Health check loop error:', err.message);
  }
}
setInterval(periodicHealthCheck, 20000); // every 20s

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('🚀 Remediator is running');
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Remediator running on port ${PORT}`));