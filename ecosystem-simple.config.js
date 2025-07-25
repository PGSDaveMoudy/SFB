module.exports = {
  apps: [{
    name: 'sfb-prod',
    script: './server.js',
    instances: 1,  // Single instance to avoid cluster issues
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    env: {
      NODE_ENV: 'production',
      PORT: 8443
    },
    // Auto-restart configuration
    autorestart: true,
    max_restarts: 5,
    min_uptime: '10s',
    // Error handling
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};