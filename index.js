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
const proUserQuestionsRoutes = require('./routes/proUserQuestions.routes');
const proWalletRoutes = require('./routes/proWallet.routes');
const proWithdrawRoutes = require('./routes/proWithdraw.routes');
const adminProUserRoutes = require('./routes/adminProUser.routes');
const QuizAttempt = require('./models/QuizAttempt');

dotenv.config();

// Quiz requirement configuration
const MONTHLY_REWARD_QUIZ_REQUIREMENT = parseInt(process.env.MONTHLY_REWARD_QUIZ_REQUIREMENT) || 220;
console.log(typeof MONTHLY_REWARD_QUIZ_REQUIREMENT, 'MONTHLY_REWARD_QUIZ_REQUIREMENT')
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

// Trust proxy for rate limiting and IP detection (required for Render.com)
app.set('trust proxy', 1);

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
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://subg-frontend.vercel.app',
    'https://subg-frontend-next.vercel.app',
    'https://subgquiz.com',
    'https://www.subgquiz.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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
app.use('/api', proUserQuestionsRoutes);
app.use('/api', proWalletRoutes);
app.use('/api', proWithdrawRoutes);
app.use('/api/admin', adminProUserRoutes);
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
    // Check daily at 9:45 PM IST to see if it's the last day of the month
    cron.schedule('23 22 * * *', async () => {
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
          
          // Find top 10 users for monthly rewards
          // Primary eligibility: Level 10 + high-score wins >= requirement
          // If fewer than 10 eligible, fill remaining slots with next best users at level 10
          // Ranking: 1) highScoreWins 2) accuracy 3) totalScore 4) totalQuizAttempts
          const sortCriteria = {
            'monthlyProgress.highScoreWins': -1,
            'monthlyProgress.accuracy': -1,
            'level.totalScore': -1,
            'monthlyProgress.totalQuizAttempts': -1
          };

          const requiredWins = Number.isFinite(Number(MONTHLY_REWARD_QUIZ_REQUIREMENT)) ? Number(MONTHLY_REWARD_QUIZ_REQUIREMENT) : 0;
          console.log(`🔎 Eligibility: monthlyProgress.highScoreWins >= ${requiredWins}`);
          const eligibleTopUsers = await User.find({
            'level.currentLevel': 10,
            'monthlyProgress.highScoreWins': { $gte: requiredWins }
          })
          .sort(sortCriteria)
          .limit(10);

          // Only users who meet the threshold are considered winners; no fallback fill
          const winnersUsers = eligibleTopUsers;

          // Save monthly winners before resetting data
          if (winnersUsers.length > 0) {
            const currentMonth = today.format('MM'); // 08 for August
            const currentYear = today.year(); // 2025
            const monthYear = today.format('YYYY-MM'); // 2024-08
            
            // Prepare winners data with new reward distribution
            const rewardDistribution = User.getRewardDistribution();
            
            let winners = winnersUsers.map((user, index) => {
              const rank = index + 1;
              const rewardInfo = rewardDistribution[index] || { amount: 0 };
              const rewardAmount = rewardInfo.amount;
              
              return {
                rank,
                userId: user._id,
                userName: user.name,
                userEmail: user.email,
                highScoreWins: user.monthlyProgress.highScoreWins,
                highScoreQuizzes: user.level.highScoreQuizzes,
                averageScore: user.level.averageScore,
                accuracy: user.monthlyProgress.accuracy,
                totalQuizAttempts: user.monthlyProgress.totalQuizAttempts,
                totalCorrectAnswers: user.level.totalScore,
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
                  totalEligibleUsers: winnersUsers.length,
                  resetTimestamp: new Date(),
                  cronJobId: 'monthly_reset_' + monthYear
                }
              },
              { upsert: true, new: true }
            );

            console.log(`📊 Monthly winners saved for ${monthYear}: ${winners.length} winners`);
          }

          // Process rewards for top 10 users with new distribution
          // Distribute rewards using new Top 10 system
          const rewardDistribution = User.getRewardDistribution();
          
          for (let i = 0; i < winnersUsers.length; i++) {
            const user = winnersUsers[i];
            const rewardInfo = rewardDistribution[i] || { amount: 0 };
            const rewardAmount = rewardInfo.amount;
            
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

        // Clear all quiz attempts for the new month
       
        const deleteResult = await QuizAttempt.deleteMany({});
        console.log(`🗑️ Cleared quiz attempts: ${deleteResult.deletedCount} records removed`);

        // Additionally, reset student progress and badges to defaults
        await User.updateMany({ role: 'student' }, {
          $set: {
            badges: ['Student'],
            'level.currentLevel': 1,
            'level.levelName': 'Starter',
            'level.quizzesPlayed': 0,
            'level.highScoreQuizzes': 0,
            'level.totalScore': 0,
            'level.averageScore': 0,
            'level.levelProgress': 0,
            'level.lastLevelUp': '',
            totalQuizzesPlayed: 0,
            quizBestScores: []
          }
        });
        console.log('✅ Monthly reset completed (including student defaults)');
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
    console.log(`✅ Database Connected to MongoDB`);
    console.log(`✅ Database URI ${process.env.MONGO_URI}`);
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

