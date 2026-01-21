// src/routes/leads.routes.js

const express = require('express');
const validateRequest = require('../middleware/validateRequest');
const { createLeadHandler } = require('../controllers/leads.controller');

const router = express.Router();

router.post(
  '/',
  validateRequest(['email', 'source']),
  createLeadHandler
);

module.exports = router;
