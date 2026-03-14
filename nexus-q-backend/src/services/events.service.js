const supabase = require('../config/supabase');
const { notifyAutomation } = require('./automationTrigger.service');
const logger = require('../utils/logger');

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
    logger.error('Failed to emit event', { error: error.message });
    throw error;
  }

  // Fire-and-forget automation notification
  notifyAutomation(data);

  return data;
}

module.exports = {
  emitEvent
};
