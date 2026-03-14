const { createLead } = require('../services/leads.service');
const logger = require('../utils/logger');

async function createLeadHandler(req, res) {
  try {
    const lead = await createLead(req.body);
    res.status(201).json(lead);
  } catch (err) {
    logger.error('Failed to create lead in controller', { error: err?.message || String(err) });
    res.status(500).json({
      error: 'Failed to create lead'
    });
  }
}

module.exports = {
  createLeadHandler
};
