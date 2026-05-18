process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// cPanel Passenger can start from repository root and delegate to the real backend app.
module.exports = require('./backend/server');