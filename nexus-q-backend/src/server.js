// src/server.js

const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info('Backend server started', { port: Number(PORT) });
});
