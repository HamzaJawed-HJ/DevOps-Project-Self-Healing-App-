async function restartContainer(containerName) {
  try {
    const res = await fetch(`/restart/${containerName}`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      showNotification(`✅ ${containerName} restarted successfully`);
    } else {
      showNotification(`❌ Failed to restart ${containerName}`);
    }
  } catch (err) {
    showNotification(`❌ Error: ${err.message}`);
  }
}

function showNotification(message) {
  const notify = document.getElementById('notify');
  notify.innerText = message;
  notify.style.display = 'block';
  setTimeout(() => notify.style.display = 'none', 3000);
}