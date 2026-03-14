const supabase = require('../config/supabase');
const { emitEvent } = require('./events.service');
const logger = require('../utils/logger');

async function createLead({ first_name, last_name, email, phone, source }) {
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      first_name,
      last_name,
      email,
      phone,
      source
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create lead', { error: error.message });
    throw error;
  }

  await emitEvent({
    entityType: 'lead',
    entityId: lead.id,
    eventType: 'lead_created',
    payload: {
      source
    }
  });

  return lead;
}

module.exports = {
  createLead
};
