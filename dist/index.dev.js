"use strict";

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

var express = require('express');

var mongoose = require('mongoose');

var dotenv = require('dotenv');

var cors = require('cors');

var helmet = require('helmet');

var rateLimit = require('express-rate-limit');

var http = require('http');

var _require = require('socket.io'),
    Server = _require.Server;

var cron = require('node-cron');

var User = require('./models/User');

var MonthlyWinners = require('./models/MonthlyWinners');

var dayjs = require('dayjs');

var authRoutes = require('./routes/authRoutes');

var adminRoutes = require('./routes/adminRoutes');

var studentRoutes = require('./routes/student');

var analyticsRoutes = require('./routes/analytics');

var subscriptionRoutes = require('./routes/subscription');

var userLevelRoutes = require('./routes/userLevel');

var contactRoutes = require('./routes/contact');

var bankDetailRoutes = require('./routes/bankDetailRoutes');

var monthlyWinnersRoutes = require('./routes/monthlyWinners');

var winston = require('winston');

var morgan = require('morgan');

var searchRoutes = require('./routes/search');

var proUserQuestionsRoutes = require('./routes/proUserQuestions.routes');

var proWalletRoutes = require('./routes/proWallet.routes');

var proWithdrawRoutes = require('./routes/proWithdraw.routes');

var adminProUserRoutes = require('./routes/adminProUser.routes');

var QuizAttempt = require('./models/QuizAttempt');

dotenv.config(); // Quiz requirement configuration

var MONTHLY_REWARD_QUIZ_REQUIREMENT = parseInt(process.env.MONTHLY_REWARD_QUIZ_REQUIREMENT) || 220;
var MONTHLY_MINIMUM_ACCURACY = parseInt(process.env.MONTHLY_MINIMUM_ACCURACY) || 75;
console.log(MONTHLY_REWARD_QUIZ_REQUIREMENT, MONTHLY_MINIMUM_ACCURACY, 'MONTHLY_REWARD_QUIZ_REQUIREMENT'); // Validate required environment variables

var requiredEnvVars = ['JWT_SECRET', 'MONGO_URI'];
requiredEnvVars.forEach(function (envVar) {
  if (!process.env[envVar]) {
    console.error("\u274C Missing required environment variable: ".concat(envVar));
    process.exit(1);
  }
}); // Ensure NODE_ENV is set

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
console.log("\uD83D\uDFE2 Running in ".concat(process.env.NODE_ENV, " mode"));
var app = express(); // Trust proxy for rate limiting and IP detection (required for Render.com)

app.set('trust proxy', 1); // Security headers

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"]
  }
})); // Rate limiting

var limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 15 minutes
  max: 1000,
  // limit each IP to 1000 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.'
});
var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 15 minutes
  max: 10,
  // limit each IP to 10 login attempts per windowMs (increased for development)
  message: 'Too many login attempts, please try again later.'
}); // Only apply rate limiting in production

if (process.env.NODE_ENV === 'production') {
  app.use(limiter);
} // CORS configuration


var corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'https://subg-frontend.vercel.app', 'https://subg-frontend-next.vercel.app', 'https://subgquiz.com', 'https://www.subgquiz.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json({
  limit: '10mb'
})); // PayU sends form-urlencoded payloads for redirects/webhooks

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));
app.use(express["static"]('public')); // Routes with rate limiting for auth

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
app.use('/api/admin', adminProUserRoutes); // app.use('/api/rewards', rewardsRoutes); // deprecated: locked rewards removed in monthly system
// Register public routes

var publicRoutes = require('./routes/public');

app.use('/api/public', publicRoutes);
app.get('/', function (req, res) {
  res.send('🚀 API is Running...');
}); // Winston logger setup

var logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.printf(function (_ref) {
    var timestamp = _ref.timestamp,
        level = _ref.level,
        message = _ref.message,
        meta = _objectWithoutProperties(_ref, ["timestamp", "level", "message"]);

    return "".concat(timestamp, " [").concat(level.toUpperCase(), "]: ").concat(message, " ").concat(Object.keys(meta).length ? JSON.stringify(meta) : '');
  })),
  transports: [new winston.transports.Console(), new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error'
  }), new winston.transports.File({
    filename: 'logs/combined.log'
  })]
}); // Morgan HTTP request logging

if (process.env.NODE_ENV === 'production') {
  var fs = require('fs');

  var path = require('path');

  var accessLogStream = fs.createWriteStream(path.join(__dirname, 'logs', 'access.log'), {
    flags: 'a'
  });
  app.use(morgan('combined', {
    stream: accessLogStream
  }));
} else {
  app.use(morgan('dev'));
} // Replace console.log/error with logger


console.log = function () {
  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  return logger.info(args.join(' '));
};

console.error = function () {
  for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  return logger.error(args.join(' '));
}; // Create HTTP server


var PORT = process.env.PORT || 5000;
var server = http.createServer(app); // Initialize Socket.IO with the server

var io = new Server(server, {
  cors: {
    origin: function origin(_origin, callback) {
      var allowedOrigins = ["http://localhost:3000", "http://127.0.0.1:3000", "https://subg-frontend.vercel.app"];

      if (!_origin || allowedOrigins.includes(_origin)) {
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
io.on("connection", function (socket) {
  console.log("Client connected: " + socket.id);
  socket.on("disconnect", function () {
    console.log("Client disconnected: " + socket.id);
  });
}); // Initialize monthly reset CRON job (runs on last day of every month at 9:00 PM IST)
// Using a daily check to find the last day of each month

var initializeMonthlyReset = function initializeMonthlyReset() {
  try {
    // Check daily at 9:00 PM IST to see if it's the last day of the month
    cron.schedule('0 21 * * *', function _callee() {
      var today, lastDayOfMonth, isLastDay, nextMonth, sortCriteria, requiredWins, requiredAccuracy, eligibleTopUsers, winnersUsers, currentMonth, currentYear, monthYear, _rewardDistribution, winners, rewardDistribution, i, user, rewardInfo, rewardAmount, deleteResult;

      return regeneratorRuntime.async(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.prev = 0;
              // Check if today is the last day of the month
              today = dayjs();
              lastDayOfMonth = today.endOf('month');
              isLastDay = today.isSame(lastDayOfMonth, 'day');

              if (isLastDay) {
                _context.next = 7;
                break;
              }

              // Not the last day, skip monthly reset
              console.log("\u23F0 Daily check: ".concat(today.format('YYYY-MM-DD'), " - Not last day of month, skipping reset"));
              return _context.abrupt("return");

            case 7:
              // Get next month for reset (since we're running on last day of current month)
              nextMonth = today.add(1, 'month').format('YYYY-MM');
              console.log("\u23F0 Monthly reset running on last day for ".concat(today.format('YYYY-MM'), ", resetting to ").concat(nextMonth, " ...")); // Find top 10 users for monthly rewards
              // Primary eligibility: Level 10 + high-score wins >= requirement
              // If fewer than 10 eligible, fill remaining slots with next best users at level 10
              // Ranking: 1) highScoreWins 2) accuracy 3) totalScore 4) totalQuizAttempts

              sortCriteria = {
                'monthlyProgress.highScoreWins': -1,
                'monthlyProgress.accuracy': -1,
                'level.totalScore': -1,
                'monthlyProgress.totalQuizAttempts': -1
              };
              requiredWins = Number.isFinite(Number(MONTHLY_REWARD_QUIZ_REQUIREMENT)) ? Number(MONTHLY_REWARD_QUIZ_REQUIREMENT) : 0;
              requiredAccuracy = Number.isFinite(Number(MONTHLY_MINIMUM_ACCURACY)) ? Number(MONTHLY_MINIMUM_ACCURACY) : 0;
              console.log("\uD83D\uDD0E Eligibility: monthlyProgress.highScoreWins >= ".concat(requiredWins));
              _context.next = 15;
              return regeneratorRuntime.awrap(User.find({
                'level.currentLevel': 10,
                'monthlyProgress.highScoreWins': {
                  $gte: requiredWins
                },
                'monthlyProgress.accuracy': {
                  $gte: requiredAccuracy
                }
              }).sort(sortCriteria).limit(10));

            case 15:
              eligibleTopUsers = _context.sent;
              // Only users who meet the threshold are considered winners; no fallback fill
              winnersUsers = eligibleTopUsers; // Save monthly winners before resetting data

              if (!(winnersUsers.length > 0)) {
                _context.next = 26;
                break;
              }

              currentMonth = today.format('MM'); // 08 for August

              currentYear = today.year(); // 2025

              monthYear = today.format('YYYY-MM'); // 2024-08
              // Prepare winners data with new reward distribution

              _rewardDistribution = User.getRewardDistribution();
              winners = winnersUsers.map(function (user, index) {
                var rank = index + 1;
                var rewardInfo = _rewardDistribution[index] || {
                  amount: 0
                };
                var rewardAmount = rewardInfo.amount;
                return {
                  rank: rank,
                  userId: user._id,
                  userName: user.name,
                  userEmail: user.email,
                  highScoreWins: user.monthlyProgress.highScoreWins,
                  highScoreQuizzes: user.level.highScoreQuizzes,
                  averageScore: user.level.averageScore,
                  accuracy: user.monthlyProgress.accuracy,
                  totalQuizAttempts: user.monthlyProgress.totalQuizAttempts,
                  totalCorrectAnswers: user.level.totalScore,
                  rewardAmount: rewardAmount,
                  claimableRewards: user.claimableRewards || 0
                };
              }); // Create or update monthly winners record

              _context.next = 25;
              return regeneratorRuntime.awrap(MonthlyWinners.findOneAndUpdate({
                monthYear: monthYear
              }, {
                month: currentMonth,
                year: currentYear,
                monthYear: monthYear,
                winners: winners,
                totalWinners: winners.length,
                resetDate: new Date(),
                processedBy: 'monthly_reset_cron',
                metadata: {
                  totalEligibleUsers: winnersUsers.length,
                  resetTimestamp: new Date(),
                  cronJobId: 'monthly_reset_' + monthYear
                }
              }, {
                upsert: true,
                "new": true
              }));

            case 25:
              console.log("\uD83D\uDCCA Monthly winners saved for ".concat(monthYear, ": ").concat(winners.length, " winners"));

            case 26:
              // Process rewards for top 10 users with new distribution
              // Distribute rewards using new Top 10 system
              rewardDistribution = User.getRewardDistribution();
              i = 0;

            case 28:
              if (!(i < winnersUsers.length)) {
                _context.next = 40;
                break;
              }

              user = winnersUsers[i];
              rewardInfo = rewardDistribution[i] || {
                amount: 0
              };
              rewardAmount = rewardInfo.amount; // Add to claimable rewards

              user.claimableRewards = (user.claimableRewards || 0) + rewardAmount;
              user.monthlyProgress.rewardRank = i + 1;
              _context.next = 36;
              return regeneratorRuntime.awrap(user.save());

            case 36:
              console.log("\uD83C\uDFC6 Monthly reward processed for ".concat(user.name, ": Rank ").concat(i + 1, ", Amount: \u20B9").concat(rewardAmount));

            case 37:
              i++;
              _context.next = 28;
              break;

            case 40:
              _context.next = 42;
              return regeneratorRuntime.awrap(User.updateMany({}, {
                $set: {
                  'monthlyProgress.month': nextMonth,
                  'monthlyProgress.highScoreWins': 0,
                  'monthlyProgress.totalQuizAttempts': 0,
                  'monthlyProgress.accuracy': 0,
                  'monthlyProgress.currentLevel': 0,
                  'monthlyProgress.rewardEligible': false,
                  'monthlyProgress.rewardRank': null
                }
              }));

            case 42:
              _context.next = 44;
              return regeneratorRuntime.awrap(QuizAttempt.deleteMany({}));

            case 44:
              deleteResult = _context.sent;
              console.log("\uD83D\uDDD1\uFE0F Cleared quiz attempts: ".concat(deleteResult.deletedCount, " records removed")); // Additionally, reset student progress and badges to defaults

              _context.next = 48;
              return regeneratorRuntime.awrap(User.updateMany({
                role: 'student'
              }, {
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
              }));

            case 48:
              console.log('✅ Monthly reset completed (including student defaults)');
              _context.next = 54;
              break;

            case 51:
              _context.prev = 51;
              _context.t0 = _context["catch"](0);
              console.error('❌ Monthly reset failed:', _context.t0);

            case 54:
            case "end":
              return _context.stop();
          }
        }
      }, null, null, [[0, 51]]);
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });
    console.log('✅ Monthly reset CRON scheduled');
  } catch (error) {
    console.error('❌ Failed to schedule monthly reset:', error);
  }
};

mongoose.connect(process.env.MONGO_URI).then(function () {
  console.log("\u2705 Database Connected to MongoDB"); //console.log(`✅ Database URI ${process.env.MONGO_URI}`);

  server.listen(PORT, function () {
    console.log("\uD83D\uDE80 Server running on port ".concat(PORT)); // Initialize monthly reset CRON job

    initializeMonthlyReset(); // Note: Annual rewards processing disabled for monthly system
  });
})["catch"](function (err) {
  console.error('❌ Failed to connect to MongoDB:', err);
});