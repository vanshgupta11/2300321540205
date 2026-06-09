const axios = require('axios');
const config = require('../config/config');

/**
 * Validates the input parameters for logging
 * @param {string} stack - The stack ('backend' or 'frontend')
 * @param {string} level - The log level ('debug', 'info', 'warn', 'error', 'fatal')
 * @param {string} packageName - The package name
 * @param {string} message - The log message
 * @returns {object} - Validation result with isValid and error message
 */
function validateLogInput(stack, level, packageName, message) {
  if (!stack || typeof stack !== 'string') {
    return { isValid: false, error: 'Stack is required and must be a string' };
  }

  if (!level || typeof level !== 'string') {
    return { isValid: false, error: 'Level is required and must be a string' };
  }

  if (!packageName || typeof packageName !== 'string') {
    return { isValid: false, error: 'Package is required and must be a string' };
  }

  if (!message || typeof message !== 'string') {
    return { isValid: false, error: 'Message is required and must be a string' };
  }

  const lowerStack = stack.toLowerCase();
  const lowerLevel = level.toLowerCase();
  const lowerPackage = packageName.toLowerCase();

  if (!config.validStacks.includes(lowerStack)) {
    return {
      isValid: false,
      error: `Invalid stack: ${stack}. Valid values are: ${config.validStacks.join(', ')}`,
    };
  }

  if (!config.validLevels.includes(lowerLevel)) {
    return {
      isValid: false,
      error: `Invalid level: ${level}. Valid values are: ${config.validLevels.join(', ')}`,
    };
  }

  const allValidPackages = [
    ...config.validPackages.backend,
    ...config.validPackages.frontend,
    ...config.validPackages.shared,
  ];

  if (!allValidPackages.includes(lowerPackage)) {
    return {
      isValid: false,
      error: `Invalid package: ${packageName}. Valid values are: ${allValidPackages.join(', ')}`,
    };
  }

  return { isValid: true };
}

/**
 * Logs a message by making an API call to the logging service
 * @param {string} stack - The stack ('backend' or 'frontend')
 * @param {string} level - The log level ('debug', 'info', 'warn', 'error', 'fatal')
 * @param {string} packageName - The package name
 * @param {string} message - The log message
 * @returns {Promise<object>} - Response from the logging API
 */
async function Log(stack, level, packageName, message) {
  try {
    // Validate input
    const validation = validateLogInput(stack, level, packageName, message);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Prepare the request body
    const requestBody = {
      stack: stack.toLowerCase(),
      level: level.toLowerCase(),
      package: packageName.toLowerCase(),
      message: message,
    };

    // Make the API call
    const response = await axios.post(config.loggingApi.url, requestBody, {
      headers: {
        'Authorization': `Bearer ${config.loggingApi.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      logID: response.data.logID,
      message: response.data.message,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data || null,
    };
  }
}

module.exports = { Log };
