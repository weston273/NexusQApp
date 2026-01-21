const axios = require('axios');
const { N8N_WEBHOOK_URL } = require('../config/env');

async function notifyAutomation(event) {
  if (!N8N_WEBHOOK_URL) return;

  try {
    await axios.post(N8N_WEBHOOK_URL, event);
  } catch (err) {
    console.error('Failed to notify n8n', err.message);
    // IMPORTANT: Do NOT fail the request
    // Events are source of truth, automation is secondary
  }
}

module.exports = {
  notifyAutomation
};
