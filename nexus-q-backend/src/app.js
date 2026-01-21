// src/app.js
const express = require('express');
const cors = require('cors');

const leadsRoutes = require('./routes/leads.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/leads', leadsRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = app;
