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
const MonthlyWinners = require('./models/MonthlyWinners');
const dayjs = require('dayjs');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/student');
const analyticsRoutes = require('./routes/analytics');
const subscriptionRoutes = require('./routes/subscription');
const userLevelRoutes = require('./routes/userLevel');
const contactRoutes = require('./routes/contact');
const bankDetailRoutes = require('./routes/bankDetailRoutes');
const monthlyWinnersRoutes = require('./routes/monthlyWinners');
const winston = require('winston');
const morgan = require('morgan');
const searchRoutes = require('./routes/search');

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'MONGO_URI'
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
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.'
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per windowMs (increased for development)
  message: 'Too many login attempts, please try again later.'
});

// Only apply rate limiting in production
if (process.env.NODE_ENV === 'production') {
  app.use(limiter);
}

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
// PayU sends form-urlencoded payloads for redirects/webhooks
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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
app.use('/api/monthly-winners', monthlyWinnersRoutes);
app.use('/api', searchRoutes);
// app.use('/api/rewards', rewardsRoutes); // deprecated: locked rewards removed in monthly system
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

// Initialize monthly reset CRON job (runs on last day of every month at 9:00 PM IST)
// Using a daily check to find the last day of each month
const initializeMonthlyReset = () => {
  try {
    // Check daily at 9:00 PM IST to see if it's the last day of the month
    cron.schedule('0 21 * * *', async () => {
              try {
          // Check if today is the last day of the month
          const today = dayjs();
          const lastDayOfMonth = today.endOf('month');
          const isLastDay = today.isSame(lastDayOfMonth, 'day');
          
          if (!isLastDay) {
            // Not the last day, skip monthly reset
            console.log(`⏰ Daily check: ${today.format('YYYY-MM-DD')} - Not last day of month, skipping reset`);
            return;
          }
          
          // Get next month for reset (since we're running on last day of current month)
          const nextMonth = today.add(1, 'month').format('YYYY-MM');
          console.log(`⏰ Monthly reset running on last day for ${today.format('YYYY-MM')}, resetting to ${nextMonth} ...`);
          
                    // First, find top 3 eligible users for monthly rewards
          const topUsers = await User.find({
            'monthlyProgress.rewardEligible': true,
            'monthlyProgress.accuracy': { $gte: 75 }
          })
          .sort({ 'monthlyProgress.highScoreWins': -1, 'monthlyProgress.accuracy': -1 })
          .limit(3);

          // Save monthly winners before resetting data
          if (topUsers.length > 0) {
            const currentMonth = today.format('MM'); // 08 for August
            const currentYear = today.year(); // 2024
            const monthYear = today.format('YYYY-MM'); // 2024-08
            
            // Prepare winners data
            const winners = topUsers.map((user, index) => {
              const rank = index + 1;
              const rewardAmount = Math.round((9999 * [3, 2, 1][index]) / 6); // 3:2:1 ratio
              
              return {
                rank,
                userId: user._id,
                userName: user.name,
                userEmail: user.email,
                highScoreWins: user.monthlyProgress.highScoreWins,
                accuracy: user.monthlyProgress.accuracy,
                rewardAmount,
                claimableRewards: user.claimableRewards || 0
              };
            });

            // Create or update monthly winners record
            await MonthlyWinners.findOneAndUpdate(
              { monthYear },
              {
                month: currentMonth,
                year: currentYear,
                monthYear,
                winners,
                totalWinners: winners.length,
                resetDate: new Date(),
                processedBy: 'monthly_reset_cron',
                metadata: {
                  totalEligibleUsers: topUsers.length,
                  resetTimestamp: new Date(),
                  cronJobId: 'monthly_reset_' + monthYear
                }
              },
              { upsert: true, new: true }
            );

            console.log(`📊 Monthly winners saved for ${monthYear}: ${winners.length} winners`);
          }

          // Process rewards for top 3 users with 3:2:1 ratio
          const totalPrizePool = 9999; // Total prize pool ₹9,999
          const ratios = [3, 2, 1]; // 3:2:1 ratio
          const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
          
          for (let i = 0; i < topUsers.length; i++) {
            const user = topUsers[i];
            // Calculate reward based on 3:2:1 ratio
            const rewardAmount = Math.round((totalPrizePool * ratios[i]) / totalRatio);
            
            // Add to claimable rewards
            user.claimableRewards = (user.claimableRewards || 0) + rewardAmount;
            user.monthlyProgress.rewardRank = i + 1;
            await user.save();
            
            console.log(`🏆 Monthly reward processed for ${user.name}: Rank ${i + 1}, Amount: ₹${rewardAmount}`);
          }

        // Reset monthly fields for all users with next month
        await User.updateMany({}, {
          $set: {
            'monthlyProgress.month': nextMonth,
            'monthlyProgress.highScoreWins': 0,
            'monthlyProgress.totalQuizAttempts': 0,
            'monthlyProgress.accuracy': 0,
            'monthlyProgress.currentLevel': 0,
            'monthlyProgress.rewardEligible': false,
            'monthlyProgress.rewardRank': null
          }
        });
        console.log('✅ Monthly reset completed');
      } catch (e) {
        console.error('❌ Monthly reset failed:', e);
      }
    }, { scheduled: true, timezone: 'Asia/Kolkata' });
    console.log('✅ Monthly reset CRON scheduled');
  } catch (error) {
    console.error('❌ Failed to schedule monthly reset:', error);
  }
};

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Database Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      
      // Initialize monthly reset CRON job
      initializeMonthlyReset();
      // Note: Annual rewards processing disabled for monthly system
    });
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
  });

