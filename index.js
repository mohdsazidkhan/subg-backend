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

// Trust proxy for rate limiting and IP detection (required for Render.com)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://vercel.live'],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", 'https:', 'wss:']
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

// --- SSR: serve frontend build and render on server ---
const path = require('path');
const fs = require('fs');

const frontendBuildPath = path.resolve(__dirname, '..', 'subg-frontend', 'build');
const indexHtmlPath = path.join(frontendBuildPath, 'index.html');

// Serve static assets first
app.use(express.static(frontendBuildPath, { maxAge: process.env.NODE_ENV === 'production' ? '1y' : 0 }));

// SSR catch-all after API routes (exclude /api and obvious asset requests)
app.get(/^(?!\/api)(?!\/static)(?!\/assets)(?!\/sockjs)(?!\/favicon\.ico).*/, async (req, res, next) => {
  // Do not SSR API or asset requests
  if (req.path.startsWith('/api') || req.path.includes('.')) {
    return next();
  }

  try {
    // Ensure build exists
    if (!fs.existsSync(indexHtmlPath)) {
      return res.status(503).send('SSR build missing on server. Ensure Render build runs: cd subg-frontend && npm ci && npm run build.');
    }

    // Read HTML template
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    // Setup babel to transpile JSX from server-entry on the fly
    require('@babel/register')({
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ],
      extensions: ['.js', '.jsx'],
      ignore: [/node_modules/]
    });

    // Ignore non-JS imports (CSS/assets) during SSR
    require.extensions['.css'] = () => null;
    require.extensions['.scss'] = () => null;
    require.extensions['.sass'] = () => null;
    require.extensions['.less'] = () => null;
    ['.png','.jpg','.jpeg','.gif','.svg','.ico','.webp'].forEach(ext => {
      require.extensions[ext] = () => null;
    });

    const { renderToString } = require('react-dom/server');
    const { render } = require(path.resolve(__dirname, '..', 'subg-frontend', 'src', 'server-entry.jsx'));

    // Build per-route meta tags
    const buildMeta = async () => {
      const defaultMeta = {
        title: 'SUBG QUIZ : Student Unknown\'s Battle Ground Quiz',
        description: 'SUBG QUIZ is a skill-based quiz app where users play exciting quizzes, level up, and become quiz legends. Unlock achievements and win exciting scholar prizes!'
      };

      const pathname = req.path;
      const staticMap = {
        '/': { title: 'SUBG QUIZ', description: defaultMeta.description },
        '/login': { title: 'Login | SUBG QUIZ', description: 'Login to continue your learning and rewards journey.' },
        '/register': { title: 'Register | SUBG QUIZ', description: 'Create your SUBG QUIZ account and start winning with knowledge.' },
        '/home': { title: 'Home | SUBG QUIZ', description: 'Your dashboard for quizzes, levels, and rewards.' },
        '/about': { title: 'About Us | SUBG QUIZ', description: 'About SUBG QUIZ - a skill-based, rewarding learning platform.' },
        '/how-it-works': { title: 'How It Works | SUBG QUIZ', description: 'How SUBG QUIZ works and rewards your knowledge fairly.' },
        '/terms': { title: 'Terms & Conditions | SUBG QUIZ', description: 'Terms and conditions for using SUBG QUIZ.' },
        '/privacy': { title: 'Privacy Policy | SUBG QUIZ', description: 'How SUBG QUIZ protects your data and privacy.' },
        '/refund': { title: 'Refund Policy | SUBG QUIZ', description: 'Refund policy for subscriptions and purchases.' },
        '/contact': { title: 'Contact Us | SUBG QUIZ', description: 'Get in touch with the SUBG QUIZ team.' },
        '/articles': { title: 'Articles | SUBG QUIZ', description: 'Read articles on knowledge, quizzes, and learning.' }
      };

      // Dynamic: article detail
      const articleDetail = pathname.match(/^\/articles\/([^\/]+)$/);
      if (articleDetail) {
        try {
          const origin = `${req.protocol}://${req.get('host')}`;
          const resp = await fetch(`${origin}/api/public/articles/${articleDetail[1]}`);
          if (resp.ok) {
            const data = await resp.json();
            const article = data?.article;
            if (article) {
              return {
                title: `${article.title} | Articles | SUBG QUIZ`,
                description: String(article.excerpt || article.description || defaultMeta.description).slice(0, 160)
              };
            }
          }
        } catch (_) {}
      }

      // Dynamic: category list
      if (pathname.startsWith('/articles/category/')) {
        return { title: 'Articles by Category | SUBG QUIZ', description: 'Browse articles by category on SUBG QUIZ.' };
      }
      // Dynamic: tag list
      if (pathname.startsWith('/articles/tag/')) {
        return { title: 'Articles by Tag | SUBG QUIZ', description: 'Browse articles by tag on SUBG QUIZ.' };
      }

      return staticMap[pathname] || defaultMeta;
    };

    const meta = await buildMeta();
    console.log(`SSR meta for ${req.path}:`, JSON.stringify(meta));

    // Inject meta into HTML
    if (meta?.title) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${meta.title}</title>`);
    }
    if (meta?.description) {
      if (/<meta\s+name=["']description["'][^>]*>/i.test(html)) {
        html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${meta.description.replace(/"/g, '&quot;')}">`);
      } else {
        html = html.replace('</head>', `<meta name="description" content="${meta.description.replace(/"/g, '&quot;')}"></head>`);
      }
    }

    const appJsx = render(req.url, {});
    const appHtml = renderToString(appJsx);

    const finalHtml = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

    return res.status(200).send(finalHtml);
  } catch (err) {
    console.error('SSR render error:', err);
    // Graceful fallback to CSR to avoid breaking the page
    try {
      const html = fs.readFileSync(indexHtmlPath, 'utf8');
      return res.status(200).send(html);
    } catch (e) {
      return res.status(500).send('Internal Server Error');
    }
  }
});

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

