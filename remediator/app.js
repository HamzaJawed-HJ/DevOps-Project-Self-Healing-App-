import express from 'express';
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const app = express();
app.use(express.json());


app.get('/', (req, res) => {
  res.send('🚀 Remediator is running');
});


// Map alert names to target containers
const ACTIONS = {
  'TargetDown': ['api'],
  'ApiHighErrorRate': ['api']
};

const ALLOWED_LABEL = process.env.ALLOWED_LABEL || 'autoheal';

// Helper to restart a container by name
async function restartByName(name) {
  const containers = await docker.listContainers({ all: true });
  const match = containers.find(c => c.Names.includes('/' + name));

  if (!match) {
    console.log(`container ${name} not found`);
    return;
  }

  // Only act if container has the autoheal=true label
  if (!match.Labels || match.Labels[ALLOWED_LABEL] !== 'true') {
    console.log(`skip ${name}: missing label ${ALLOWED_LABEL}=true`);
    return;
  }

  const container = docker.getContainer(match.Id);
  console.log(`🔄 Restarting ${name} due to alert...`);
  await container.restart();
}

// Webhook receiver for Alertmanager
app.post('/alerts', async (req, res) => {
  try {
    const alerts = req.body.alerts || [];
    for (const a of alerts) {
      const alertName = a.labels?.alertname;
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

// Extra: periodic health check (restart unhealthy containers after 3 fails)
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
        }
      } else {
        unhealthyCounts.set(name, 0);
      }
    }
  } catch (err) {
    console.error('health loop error:', err.message);
  }
}
setInterval(periodicHealthCheck, 20000);

app.listen(8080, () => console.log('🚀 Remediator running on port 8080'));
