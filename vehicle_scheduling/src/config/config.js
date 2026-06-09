require('dotenv').config();

const config = {
  loggingApi: {
    url: process.env.LOGGING_API_URL || 'http://4.224.186.213/evaluation-service/logs',
    accessToken: process.env.ACCESS_TOKEN,
  },
  validStacks: ['backend', 'frontend'],
  validLevels: ['debug', 'info', 'warn', 'error', 'fatal'],
  validPackages: {
    backend: ['cache', 'controller', 'cron_job', 'db', 'domain', 'handler', 'repository', 'route', 'service'],
    frontend: ['api', 'component', 'hook', 'page', 'state', 'style'],
    shared: ['auth', 'config', 'middleware', 'utils'],
  },
};

module.exports = config;
