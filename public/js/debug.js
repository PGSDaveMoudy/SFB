/**
 * Centralized Debug System for Salesforce Form Builder
 * Replaces all console.log statements with configurable logging
 */

// Debug levels
const DEBUG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    VERBOSE: 4
};

// Current debug level (can be changed via localStorage or programmatically)
let currentDebugLevel = parseInt(localStorage.getItem('sfb_debug_level')) || DEBUG_LEVELS.INFO;

// Module-specific debug states (can enable/disable per module)
const moduleDebugState = JSON.parse(localStorage.getItem('sfb_module_debug')) || {};

// Debug utilities
class DebugSystem {
    static setLevel(level) {
        if (typeof level === 'string') {
            level = DEBUG_LEVELS[level.toUpperCase()] || DEBUG_LEVELS.INFO;
        }
        currentDebugLevel = level;
        localStorage.setItem('sfb_debug_level', level.toString());
        console.log(`🔧 Debug level set to: ${Object.keys(DEBUG_LEVELS)[level]}`);
    }

    static getLevel() {
        return currentDebugLevel;
    }

    static enableModule(moduleName) {
        moduleDebugState[moduleName] = true;
        localStorage.setItem('sfb_module_debug', JSON.stringify(moduleDebugState));
        console.log(`🔧 Debug enabled for module: ${moduleName}`);
    }

    static disableModule(moduleName) {
        moduleDebugState[moduleName] = false;
        localStorage.setItem('sfb_module_debug', JSON.stringify(moduleDebugState));
        console.log(`🔧 Debug disabled for module: ${moduleName}`);
    }

    static isModuleEnabled(moduleName) {
        return moduleDebugState[moduleName] !== false; // Default to enabled
    }

    static showConfig() {
        console.group('🔧 SFB Debug Configuration');
        console.log('Current Level:', Object.keys(DEBUG_LEVELS)[currentDebugLevel]);
        console.log('Module States:', moduleDebugState);
        console.groupEnd();
    }

    static reset() {
        currentDebugLevel = DEBUG_LEVELS.INFO;
        localStorage.removeItem('sfb_debug_level');
        localStorage.removeItem('sfb_module_debug');
        console.log('🔧 Debug system reset to defaults');
    }
}

// Main debug function
function debug(level, moduleName, message, ...args) {
    // Check if logging is enabled for this level and module
    if (level > currentDebugLevel || !DebugSystem.isModuleEnabled(moduleName)) {
        return;
    }

    // Get level name and emoji
    const levelName = Object.keys(DEBUG_LEVELS)[level];
    const emojis = { ERROR: '❌', WARN: '⚠️', INFO: 'ℹ️', DEBUG: '🐛', VERBOSE: '🔍' };
    const emoji = emojis[levelName] || '📝';

    // Format the log message
    const prefix = `${emoji} [${moduleName}]`;
    
    // Use appropriate console method
    switch (level) {
        case DEBUG_LEVELS.ERROR:
            console.error(prefix, message, ...args);
            break;
        case DEBUG_LEVELS.WARN:
            console.warn(prefix, message, ...args);
            break;
        default:
            console.log(prefix, message, ...args);
    }
}

// Convenience functions for each debug level
const debugError = (module, message, ...args) => debug(DEBUG_LEVELS.ERROR, module, message, ...args);
const debugWarn = (module, message, ...args) => debug(DEBUG_LEVELS.WARN, module, message, ...args);
const debugInfo = (module, message, ...args) => debug(DEBUG_LEVELS.INFO, module, message, ...args);
const debugDebug = (module, message, ...args) => debug(DEBUG_LEVELS.DEBUG, module, message, ...args);
const debugVerbose = (module, message, ...args) => debug(DEBUG_LEVELS.VERBOSE, module, message, ...args);

// Performance measurement utilities
const perfTimers = new Map();

function debugPerfStart(module, label) {
    const key = `${module}:${label}`;
    perfTimers.set(key, performance.now());
    debugVerbose(module, `⏱️ Started timer: ${label}`);
}

function debugPerfEnd(module, label) {
    const key = `${module}:${label}`;
    const startTime = perfTimers.get(key);
    if (startTime) {
        const duration = performance.now() - startTime;
        debugInfo(module, `⏱️ ${label}: ${duration.toFixed(2)}ms`);
        perfTimers.delete(key);
    }
}

// Global exposure for use in modules
if (typeof window !== 'undefined') {
    window.SFBDebug = {
        debug,
        debugError,
        debugWarn,
        debugInfo,
        debugDebug,
        debugVerbose,
        debugPerfStart,
        debugPerfEnd,
        DebugSystem,
        DEBUG_LEVELS
    };
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        debug,
        debugError,
        debugWarn,
        debugInfo,
        debugDebug,
        debugVerbose,
        debugPerfStart,
        debugPerfEnd,
        DebugSystem,
        DEBUG_LEVELS
    };
}