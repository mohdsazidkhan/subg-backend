const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const User = require('./models/User');
const { unlockRewards } = require('./controllers/rewardsController');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/student');
const analyticsRoutes = require('./routes/analytics');
const subscriptionRoutes = require('./routes/subscription');
const userLevelRoutes = require('./routes/userLevel');
const contactRoutes = require('./routes/contact');
const bankDetailRoutes = require('./routes/bankDetailRoutes');
const winston = require('winston');
const morgan = require('morgan');
const searchRoutes = require('./routes/search');
const rewardsRoutes = require('./routes/rewards');

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'MONGO_URI',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_SECRET'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

// Ensure NODE_ENV is set
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`🟢 Running in ${process.env.NODE_ENV} mode`);

const app = express();

// Security headers
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later.'
});

app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://subg-frontend.vercel.app',
    'https://subgquiz.com',
    'https://www.subgquiz.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Routes with rate limiting for auth
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/levels', userLevelRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/bank-details', bankDetailRoutes);
app.use('/api', searchRoutes);
app.use('/api/rewards', rewardsRoutes);
// Register public routes
const publicRoutes = require('./routes/public');
app.use('/api/public', publicRoutes);

app.get('/', (req, res) => {
  res.send('🚀 API is Running...');
});

// Winston logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Morgan HTTP request logging
if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const path = require('path');
  const accessLogStream = fs.createWriteStream(path.join(__dirname, 'logs', 'access.log'), { flags: 'a' });
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  app.use(morgan('dev'));
}

// Replace console.log/error with logger
console.log = (...args) => logger.info(args.join(' '));
console.error = (...args) => logger.error(args.join(' '));

// Create HTTP server
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.IO with the server
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://subg-frontend.vercel.app"
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation"), false);
      }
    },
    methods: ["GET", "POST"]
  },
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ['websocket']
});

io.on("connection", (socket) => {
  console.log("Client connected: " + socket.id);
  
  socket.on("disconnect", () => {
    console.log("Client disconnected: " + socket.id);
  });
});

// Initialize rewards processing CRON job
const initializeRewardsProcessing = () => {
  try {
    // Schedule rewards processing to run daily at 2 AM IST
    cron.schedule('0 2 * * *', async () => {
      console.log('⏰ Running scheduled Level 10 rewards processing...');
      try {
        // Get Top 3 users from Level 10
        const level10Users = await User.find({
          role: 'student',
          'level.currentLevel': 10
        })
          .select('_id level')
          .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
          .limit(3);

        for (const user of level10Users) {
          await unlockRewards(user._id);
        }

        console.log('✅ Scheduled rewards processing completed successfully');
      } catch (error) {
        console.error('❌ Error in scheduled rewards processing:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });
    
    console.log('✅ Rewards processing CRON job scheduled for daily at 2 AM IST');
  } catch (error) {
    console.error('❌ Failed to initialize rewards processing CRON job:', error);
  }
};

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Database Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      
      // Initialize rewards processing CRON job
      initializeRewardsProcessing();
    });
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
  });

