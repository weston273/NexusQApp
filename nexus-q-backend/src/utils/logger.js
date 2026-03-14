function log(level, message, meta) {
  const payload = {
    level,
    message,
    at: new Date().toISOString(),
  };
  if (meta !== undefined) {
    payload.meta = meta;
  }
  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  console.log(serialized);
}

function info(message, meta) {
  log('info', message, meta);
}

function error(message, meta) {
  log('error', message, meta);
}

module.exports = {
  info,
  error,
};
