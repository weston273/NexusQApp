const supabase = require('../config/supabase');
const { emitEvent } = require('./events.service');

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
    console.error('Failed to create lead', error);
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
