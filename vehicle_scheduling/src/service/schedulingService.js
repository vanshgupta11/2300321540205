const axios = require('axios');
const { Log } = require('../middleware/logger');

const DEPOT_API = 'http://4.224.186.213/evaluation-service/depots';
const VEHICLES_API = 'http://4.224.186.213/evaluation-service/vehicles';

/**
 * Fetches depot data from the API
 * @returns {Promise<Array>} Array of depot objects with ID and MechanicHours
 */
async function fetchDepots() {
  try {
    await Log('backend', 'debug', 'service', 'Fetching depot data from API');
    
    const response = await axios.get(DEPOT_API);
    
    if (!response.data || !response.data.depots) {
      await Log('backend', 'error', 'service', 'Invalid depot API response structure');
      return [];
    }

    const depots = response.data.depots;
    await Log('backend', 'info', 'service', `Successfully fetched ${depots.length} depots`);
    
    return depots;
  } catch (error) {
    await Log('backend', 'error', 'service', `Failed to fetch depots: ${error.message}`);
    return [];
  }
}

/**
 * Fetches vehicle/task data from the API
 * @returns {Promise<Array>} Array of vehicle objects with TaskID, Duration, and Impact
 */
async function fetchVehicles() {
  try {
    await Log('backend', 'debug', 'service', 'Fetching vehicle task data from API');
    
    const response = await axios.get(VEHICLES_API);
    
    if (!response.data || !response.data.vehicles) {
      await Log('backend', 'error', 'service', 'Invalid vehicles API response structure');
      return [];
    }

    const vehicles = response.data.vehicles;
    await Log('backend', 'info', 'service', `Successfully fetched ${vehicles.length} vehicle tasks`);
    
    return vehicles;
  } catch (error) {
    await Log('backend', 'error', 'service', `Failed to fetch vehicles: ${error.message}`);
    return [];
  }
}

/**
 * Solves the 0/1 Knapsack problem using dynamic programming
 * Returns the maximum impact score within budget constraint
 * 
 * @param {Array} tasks - Array of tasks with Duration and Impact properties
 * @param {number} capacity - Available mechanic hours (budget)
 * @returns {Promise<Object>} { totalImpact, selectedTasks, totalDuration }
 */
async function solveKnapsack(tasks, capacity) {
  try {
    const n = tasks.length;
    await Log('backend', 'debug', 'service', `Starting knapsack optimization: ${n} tasks, ${capacity} hour capacity`);

    // Edge case: no tasks or no capacity
    if (n === 0 || capacity === 0) {
      await Log('backend', 'info', 'service', 'No tasks or capacity available');
      return { totalImpact: 0, selectedTasks: [], totalDuration: 0 };
    }

    // DP table: dp[i][w] = max impact using first i items with capacity w
    const dp = Array(n + 1).fill(null).map(() => Array(capacity + 1).fill(0));

    // Fill the DP table
    for (let i = 1; i <= n; i++) {
      const task = tasks[i - 1];
      const duration = Math.ceil(task.Duration); // Round up duration to nearest hour
      const impact = task.Impact;

      for (let w = 0; w <= capacity; w++) {
        // Option 1: Don't include this task
        dp[i][w] = dp[i - 1][w];

        // Option 2: Include this task if it fits
        if (duration <= w) {
          const includeValue = impact + dp[i - 1][w - duration];
          dp[i][w] = Math.max(dp[i][w], includeValue);
        }
      }
    }

    // Backtrack to find which tasks were selected
    const selectedTasks = [];
    let w = capacity;

    for (let i = n; i > 0 && w > 0; i--) {
      // If value comes from including this item
      if (dp[i][w] !== dp[i - 1][w]) {
        const task = tasks[i - 1];
        selectedTasks.push(task);
        w -= Math.ceil(task.Duration);
      }
    }

    // Reverse to maintain original order
    selectedTasks.reverse();

    const totalImpact = dp[n][capacity];
    const totalDuration = selectedTasks.reduce((sum, task) => sum + Math.ceil(task.Duration), 0);

    await Log('backend', 'info', 'service', `Knapsack optimization complete: selected ${selectedTasks.length} tasks, impact ${totalImpact}, duration ${totalDuration}h`);

    return {
      totalImpact,
      selectedTasks,
      totalDuration,
    };
  } catch (error) {
    await Log('backend', 'error', 'service', `Knapsack algorithm error: ${error.message}`);
    return { totalImpact: 0, selectedTasks: [], totalDuration: 0 };
  }
}

/**
 * Main scheduling service - fetches data and solves optimization
 * @param {number} depotId - ID of the depot
 * @returns {Promise<Object>} Scheduling result with selected tasks
 */
async function scheduleVehicleMaintenance(depotId) {
  try {
    await Log('backend', 'info', 'service', `Starting vehicle maintenance scheduling for depot ${depotId}`);

    // Fetch data
    const depots = await fetchDepots();
    const vehicles = await fetchVehicles();

    if (depots.length === 0 || vehicles.length === 0) {
      await Log('backend', 'warn', 'service', 'No depot or vehicle data available for scheduling');
      return {
        success: false,
        error: 'Unable to fetch required data',
      };
    }

    // Find the specified depot
    const depot = depots.find(d => d.ID === depotId);
    if (!depot) {
      await Log('backend', 'warn', 'service', `Depot ${depotId} not found in depot list`);
      return {
        success: false,
        error: `Depot ${depotId} not found`,
      };
    }

    const mechanicHours = depot.MechanicHours;
    await Log('backend', 'info', 'service', `Depot ${depotId} has ${mechanicHours} mechanic hours available`);

    // Solve the knapsack problem
    const result = solveKnapsack(vehicles, mechanicHours);

    await Log('backend', 'info', 'service', `Scheduling complete for depot ${depotId}: selected ${result.selectedTasks.length} tasks`);

    return {
      success: true,
      depotId,
      mechanicHours,
      schedule: {
        totalImpact: result.totalImpact,
        totalDuration: result.totalDuration,
        tasksCount: result.selectedTasks.length,
        tasks: result.selectedTasks,
      },
    };
  } catch (error) {
    await Log('backend', 'error', 'service', `Scheduling service error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Schedule all depots simultaneously
 * @returns {Promise<Object>} Results for all depots
 */
async function scheduleAllDepots() {
  try {
    await Log('backend', 'info', 'service', 'Starting scheduling for all depots');

    const depots = await fetchDepots();
    if (depots.length === 0) {
      await Log('backend', 'warn', 'service', 'No depots available for scheduling');
      return {
        success: false,
        error: 'No depots found',
      };
    }

    // Schedule each depot
    const schedules = [];
    for (const depot of depots) {
      const schedule = await scheduleVehicleMaintenance(depot.ID);
      schedules.push(schedule);
    }

    await Log('backend', 'info', 'service', `All depot scheduling complete: ${schedules.length} depots processed`);

    return {
      success: true,
      depotCount: schedules.length,
      schedules,
    };
  } catch (error) {
    await Log('backend', 'error', 'service', `All depots scheduling error: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  fetchDepots,
  fetchVehicles,
  solveKnapsack,
  scheduleVehicleMaintenance,
  scheduleAllDepots,
};
