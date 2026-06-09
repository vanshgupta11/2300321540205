const { Log } = require('./middleware/logger');
const { scheduleVehicleMaintenance, scheduleAllDepots } = require('./service/schedulingService');

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await Log('backend', 'info', 'route', 'Health check endpoint called');

    res.json({
      status: 'ok',
      message: 'Vehicle Maintenance Scheduler Backend is running',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await Log('backend', 'error', 'route', `Health check error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Schedule vehicles for a specific depot
 * GET /api/schedule/:depotId
 */
app.get('/api/schedule/:depotId', async (req, res) => {
  try {
    const depotId = parseInt(req.params.depotId);

    await Log('backend', 'info', 'route', `Schedule request received for depot ${depotId}`);

    if (isNaN(depotId)) {
      await Log('backend', 'warn', 'handler', `Invalid depot ID provided: ${req.params.depotId}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid depot ID. Must be a number.',
      });
    }

    const result = await scheduleVehicleMaintenance(depotId);

    if (result.success) {
      await Log('backend', 'info', 'route', `Schedule generated for depot ${depotId}: impact ${result.schedule.totalImpact}`);
      res.json(result);
    } else {
      await Log('backend', 'warn', 'route', `Schedule failed for depot ${depotId}: ${result.error}`);
      res.status(400).json(result);
    }
  } catch (error) {
    await Log('backend', 'error', 'route', `Schedule endpoint error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Schedule vehicles for all depots
 * GET /api/schedule-all
 */
app.get('/api/schedule-all', async (req, res) => {
  try {
    await Log('backend', 'info', 'route', 'Schedule-all request received');

    const result = await scheduleAllDepots();

    if (result.success) {
      await Log('backend', 'info', 'route', `All depots scheduled successfully: ${result.depotCount} depots`);
      res.json(result);
    } else {
      await Log('backend', 'warn', 'route', `Schedule-all failed: ${result.error}`);
      res.status(400).json(result);
    }
  } catch (error) {
    await Log('backend', 'error', 'route', `Schedule-all endpoint error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Test logging endpoint (from pre-test setup)
 * POST /api/test-logging
 */
app.post('/api/test-logging', async (req, res) => {
  try {
    const { stack, level, packageName, message } = req.body;

    await Log('backend', 'debug', 'handler', 'Test logging endpoint called');

    if (!stack || !level || !packageName || !message) {
      await Log('backend', 'warn', 'handler', 'Test logging endpoint called with incomplete parameters');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { Log: LogFunction } = require('./middleware/logger');
    const result = await LogFunction(stack, level, packageName, message);

    if (result.success) {
      res.json({
        success: true,
        logID: result.logID,
        message: result.message,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    await Log('backend', 'error', 'handler', `Test logging endpoint error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use((req, res) => {
  Log('backend', 'warn', 'route', `Unknown endpoint requested: ${req.method} ${req.path}`).catch(() => {});
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  Log('backend', 'error', 'route', `Unhandled error: ${err.message}`).catch(() => {});
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(PORT, () => {
  Log('backend', 'info', 'route', `Backend server started on port ${PORT}`).catch(() => {});
});

module.exports = app;
