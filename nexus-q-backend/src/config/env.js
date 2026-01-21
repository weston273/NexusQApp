// src/config/env.js
require('dotenv').config();

module.exports = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL
};
