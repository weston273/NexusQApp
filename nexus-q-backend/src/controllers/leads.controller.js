const { createLead } = require('../services/leads.service');

async function createLeadHandler(req, res) {
  try {
    const lead = await createLead(req.body);
    res.status(201).json(lead);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to create lead'
    });
  }
}

module.exports = {
  createLeadHandler
};
