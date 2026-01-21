const supabase = require('../config/supabase');
const { notifyAutomation } = require('./automationTrigger.service');

async function emitEvent({
  entityType,
  entityId,
  eventType,
  payload
}) {
  const eventRecord = {
    entity_type: entityType,
    entity_id: entityId,
    event_type: eventType,
    payload: payload || {}
  };

  const { data, error } = await supabase
    .from('events')
    .insert(eventRecord)
    .select()
    .single();

  if (error) {
    console.error('Failed to emit event', error);
    throw error;
  }

  // Fire-and-forget automation notification
  notifyAutomation(data);

  return data;
}

module.exports = {
  emitEvent
};
