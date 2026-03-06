console.log('🚀 ==== SERVER.JS STARTING ==== 🚀');
const express = require('express');
console.log('✅ Express loaded');
const cors = require('cors');
console.log('✅ CORS loaded');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: __dirname + '/.env' });
console.log('✅ Environment loaded');

const logger = require('./utils/logger');
console.log('✅ Logger loaded');
const errorHandler = require('./middleware/errorHandler');
console.log('✅ ErrorHandler loaded');

let routes;
try {
  routes = require('./routes');
  console.log('✅ Routes loaded');
} catch (error) {
  console.error('❌ FATAL: Error loading routes:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
}

const { initializeDatabase } = require('./config/database');
console.log('✅ Database config loaded');

// Initialize audit log cleanup scheduler (after database is ready)
// Will be started in startServer() after database connection
// require('./schedulers/auditLogCleanup');
// console.log('✅ Audit log cleanup scheduler loaded');

console.log('🔧 Creating Express app...');
const app = express();
const PORT = process.env.PORT || 5000;
console.log(`📍 Port set to: ${PORT}`);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for React app
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

// Enable ETag for better caching
app.set('etag', 'strong');

// Rate limiting - more generous for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 2000, // Increased: 2000 for dev, 500 for prod
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});
app.use('/api', limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.56.1:3000',
      'http://172.16.0.2:3000',
      'https://inventra.ivms2006.com',
      'http://inventra.ivms2006.com',
      'https://test.inventra.ivms2006.com',
      'http://test.inventra.ivms2006.com',
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    // Allow any origin from local network in development
    if (process.env.NODE_ENV !== 'production' && origin) {
      const isLocalNetwork = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.\d+\.\d+\.\d+):3000$/.test(origin);
      if (isLocalNetwork) {
        return callback(null, true);
      }
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow in production to prevent issues
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Serve React static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from React build
  const frontendPath = path.join(__dirname, '..', 'frontend', 'build');
  app.use(express.static(frontendPath));
  
  logger.info(`📁 Serving frontend from: ${frontendPath}`);
}

// API routes
app.use('/api/v1', routes);

// Debug endpoint - Check which database is being used
app.get('/api/debug/env', (req, res) => {
  res.json({
    '🔍 DATABASE CONFIG': {
      DB_NAME: process.env.DB_NAME,
      DB_HOST: process.env.DB_HOST,
      DB_USER: process.env.DB_USER,
      DB_PORT: process.env.DB_PORT
    },
    '🌍 ENVIRONMENT': {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT
    },
    '📂 FILE SYSTEM': {
      currentDirectory: __dirname,
      envFileExists: require('fs').existsSync(path.join(__dirname, '.env')),
      envFilePath: path.join(__dirname, '.env')
    },
    '🔑 ALL DB VARIABLES': Object.keys(process.env)
      .filter(key => key.startsWith('DB_'))
      .reduce((obj, key) => {
        obj[key] = process.env[key];
        return obj;
      }, {})
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Inventra API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// 404 handler for API routes only
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});

// Serve React app for all other routes (must be after API routes)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const frontendPath = path.join(__dirname, '..', 'frontend', 'build', 'index.html');
    res.sendFile(frontendPath, (err) => {
      if (err) {
        logger.error('Error serving index.html:', err);
        res.status(500).send('Error loading application');
      }
    });
  });
} else {
  // In development, show a message
  app.get('*', (req, res) => {
    res.json({
      success: true,
      message: 'Inventra API Server - Development Mode',
      note: 'Frontend should be running on http://localhost:3000',
      apiEndpoint: '/api/v1'
    });
  });
}

// Global error handler
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('🔧 Starting server initialization...');
    console.log('📍 Environment:', process.env.NODE_ENV);
    console.log('📍 Port:', PORT);
    
    // Try to initialize database connection (but don't fail if it doesn't work)
    console.log('🔌 Attempting database connection...');
    await initializeDatabase();
    console.log('✅ Database initialization complete');
    
    // Initialize audit log cleanup scheduler after database is ready
    require('./schedulers/auditLogCleanup');
    console.log('✅ Audit log cleanup scheduler loaded');
    
    // Mount maintenance routes after database is initialized to avoid circular dependency
    const maintenanceRoutes = require('./routes/maintenance');
    app.use('/api/v1/maintenance', maintenanceRoutes);
    console.log('✅ Maintenance routes loaded');
    
    console.log('✨ About to start server on port:', PORT);
    
    // Start server regardless of database connection status
    try {
      const server = app.listen(PORT, '0.0.0.0', () => {
        logger.info(`🚀 Inventra Backend Server running on port ${PORT}`);
        logger.info(`📍 Environment: ${process.env.NODE_ENV}`);
        logger.info(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN}`);
        logger.info(`🌍 Server accessible on all network interfaces (0.0.0.0)`);
        console.log(`🚀 Server started successfully on port ${PORT}`);
      });
      
      server.on('error', (error) => {
        logger.error('Server error:', error);
        console.error('❌ Server error:', error);
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${PORT} is already in use. Please free the port or use a different one.`);
          console.error(`Port ${PORT} is already in use.`);
        }
        process.exit(1);
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Critical error in startServer:', error);
    logger.error('Failed to start server:', error);
    logger.warn('Database initialization failed, but server will continue:', error.message);
    // Don't exit - try to start server anyway
    console.log('⚠️  Attempting to start server despite errors...');
    try {
      const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server started on port ${PORT} (with errors)`);
      });
    } catch (serverError) {
      console.error('❌ Could not start server:', serverError);
      process.exit(1);
    }
  }
};

console.log('📋 Server script loaded, calling startServer()...');
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;

//first commit staging branch
//second commit 