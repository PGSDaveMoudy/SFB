module.exports = {
  apps: [{
    name: 'sfb-prod',
    script: './server.js',
    instances: 4,  // Use 4 instances for load balancing
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '2G',
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
    max_restarts: 10,
    min_uptime: '10s',
    // Performance optimizations
    listen_timeout: 10000,
    kill_timeout: 5000,
    // Monitoring
    instance_var: 'INSTANCE_ID',
    merge_logs: true,
    // Error handling
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};