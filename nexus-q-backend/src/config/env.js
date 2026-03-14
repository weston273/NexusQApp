// src/config/env.js
require('dotenv').config();

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

module.exports = {
  SUPABASE_URL: readRequiredEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_KEY: readRequiredEnv('SUPABASE_SERVICE_KEY'),
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL || null,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || ''
};
