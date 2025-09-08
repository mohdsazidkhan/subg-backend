const User = require('../models/User');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Question = require('../models/Question');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Subscription = require('../models/Subscription');
const PaymentOrder = require('../models/PaymentOrder');
const Leaderboard = require('../models/Leaderboard');

// Helper function to get level names
const getLevelName = (level) => {
  const levelNames = {
    0: 'Starter', 1: 'Rookie', 2: 'Explorer', 3: 'Thinker', 4: 'Strategist', 5: 'Achiever',
    6: 'Mastermind', 7: 'Champion', 8: 'Prodigy', 9: 'Wizard', 10: 'Legend'
  };
  return levelNames[level] || 'Unknown';
};


// Helper function to get date range
const getDateRange = (period = 'current-month') => {
  const now = new Date();
  const startDate = new Date();
  
  switch (period) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'current-month':
      // Current month (from 1st to today)
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'last-month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      // Default to current month
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
  }
  
  return { startDate, endDate: now };
};

// Dashboard Overview Analytics
exports.getDashboardOverview = async (req, res) => {
  try {
    const { period = 'current-month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const [
      totalUsers,
      totalQuizzes,
      totalQuestions,
      totalAttempts,
      totalSubscriptions,
      totalRevenue,
      activeUsers,
      newUsersInPeriod,
      newQuizzesInPeriod,
      attemptsInPeriod,
      revenueInPeriod
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Quiz.countDocuments({ isActive: true }),
      Question.countDocuments(),
      QuizAttempt.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      PaymentOrder.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      User.countDocuments({ 
        role: 'student',
        'level.lastLevelUp': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
      }),
      User.countDocuments({ 
        role: 'student',
        createdAt: { $gte: startDate, $lte: endDate } 
      }),
      Quiz.countDocuments({ 
        createdAt: { $gte: startDate, $lte: endDate } 
      }),
      QuizAttempt.countDocuments({ 
        attemptedAt: { $gte: startDate, $lte: endDate } 
      }),
      PaymentOrder.aggregate([
        { 
          $match: { 
            status: 'paid',
            createdAt: { $gte: startDate, $lte: endDate }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    // Get level distribution
    const levelDistribution = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $group: {
          _id: '$level.currentLevel',
          count: { $sum: 1 },
          avgScore: { $avg: '$level.averageScore' },
          avgQuizzes: { $avg: '$level.quizzesPlayed' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get subscription distribution
    const subscriptionDistribution = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $group: {
          _id: '$subscriptionStatus',
          count: { $sum: 1 },
          avgLevel: { $avg: '$level.currentLevel' }
        }
      }
    ]);

    // Get recent activity
    const recentAttempts = await QuizAttempt.find()
      .populate('user', 'name level')
      .populate('quiz', 'title category')
      .sort({ attemptedAt: -1 })
      .limit(10);

    // Get top performing users with monthly progress (same sorting as performance analytics)
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    const topUsers = await User.find({ role: 'student' })
      .sort({ 
        'monthlyProgress.highScoreWins': -1, 
        'monthlyProgress.accuracy': -1, 
        'monthlyProgress.totalQuizAttempts': -1,
        'level.averageScore': -1
      })
      .limit(10)
      .select('name level badges subscriptionStatus monthlyProgress');

    // Format topUsers to include monthlyProgress data
    const formattedTopUsers = topUsers.map(user => {
      const monthlyData = user.monthlyProgress || {};
      const levelData = user.level || {};
      
      return {
        ...user.toObject(),
        monthlyProgress: {
          highScoreWins: monthlyData.highScoreWins || 0,
          accuracy: monthlyData.accuracy || 0,
          currentLevel: monthlyData.currentLevel || levelData.currentLevel || 0,
          totalQuizAttempts: monthlyData.totalQuizAttempts || levelData.quizzesPlayed || 0,
          month: monthlyData.month || new Date().toISOString().slice(0, 7)
        }
      };
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalQuizzes,
          totalQuestions,
          totalAttempts,
          totalSubscriptions,
          totalRevenue: totalRevenue[0]?.total || 0,
          activeUsers,
          newUsersInPeriod,
          newQuizzesInPeriod,
          attemptsInPeriod,
          revenueInPeriod: revenueInPeriod[0]?.total || 0,
          period
        },
        levelDistribution,
        subscriptionDistribution,
        recentActivity: recentAttempts,
        topUsers: formattedTopUsers
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard overview',
      error: error.message
    });
  }
};

// User Analytics
exports.getUserAnalytics = async (req, res) => {
  try {
    const { period = 'current-month', level, subscription, dateRange } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Build filter
    const filter = { role: 'student' };
    if (level) filter['level.currentLevel'] = parseInt(level);
    if (subscription) filter.subscriptionStatus = subscription;

    // Date filter
    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };

    const [
      totalUsers,
      newUsers,
      activeUsers,
      levelDistribution,
      subscriptionStats,
      userGrowth,
      topPerformers,
      userEngagement,
      userRetention
    ] = await Promise.all([
      User.countDocuments(filter),
      User.countDocuments({ ...filter, ...dateFilter }),
      User.countDocuments({ 
        ...filter, 
        'level.lastLevelUp': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
      }),
      User.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$level.currentLevel',
            count: { $sum: 1 },
            avgScore: { $avg: '$level.averageScore' },
            avgQuizzes: { $avg: '$level.quizzesPlayed' },
            avgHighScores: { $avg: '$level.highScoreQuizzes' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      User.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$subscriptionStatus',
            count: { $sum: 1 },
            avgLevel: { $avg: '$level.currentLevel' },
            avgScore: { $avg: '$level.averageScore' },
            avgQuizzes: { $avg: '$level.quizzesPlayed' }
          }
        }
      ]),
      User.aggregate([
        { $match: { ...filter, ...dateFilter } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),
      User.find(filter)
        .sort({ 'level.highScoreQuizzes': -1, 'level.averageScore': -1 })
        .limit(20)
        .select('name level badges subscriptionStatus createdAt')
        .lean(),
      User.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            avgQuizzesPlayed: { $avg: '$level.quizzesPlayed' },
            avgHighScoreQuizzes: { $avg: '$level.highScoreQuizzes' },
            avgLevel: { $avg: '$level.currentLevel' },
            avgScore: { $avg: '$level.averageScore' },
            totalQuizzesPlayed: { $sum: '$level.quizzesPlayed' },
            totalHighScoreQuizzes: { $sum: '$level.highScoreQuizzes' },
            maxLevel: { $max: '$level.currentLevel' },
            minLevel: { $min: '$level.currentLevel' }
          }
        }
      ]),
      User.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" }
            },
            newUsers: { $sum: 1 },
            activeUsers: {
              $sum: {
                $cond: [
                  { $gte: ["$level.lastLevelUp", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                  1,
                  0
                ]
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Format top performers to include accuracy
    const formattedTopPerformers = topPerformers.map(user => {
      const highScoreQuizzes = user.level?.highScoreQuizzes || 0;
      const quizzesPlayed = user.level?.quizzesPlayed || 0;
      const accuracy = quizzesPlayed > 0 ? Math.round((highScoreQuizzes / quizzesPlayed) * 100) : 0;
      
      return {
        ...user,
        level: {
          ...user.level,
          accuracy: accuracy
        }
      };
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          newUsers,
          activeUsers,
          period
        },
        levelDistribution,
        subscriptionStats,
        userGrowth,
        topPerformers: formattedTopPerformers,
        userEngagement: userEngagement[0] || {},
        userRetention
      }
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user analytics',
      error: error.message
    });
  }
};

// Quiz Analytics
exports.getQuizAnalytics = async (req, res) => {
  try {
    const { period = 'current-month', category, difficulty } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Build filter
    const quizFilter = { isActive: true };
    if (category) quizFilter.category = category;
    if (difficulty) quizFilter.difficulty = difficulty;

    const attemptFilter = { attemptedAt: { $gte: startDate, $lte: endDate } };

    const [
      totalQuizzes,
      totalAttempts,
      avgScore,
      categoryStats,
      difficultyStats,
      levelStats,
      topQuizzes,
      quizPerformance,
      recentQuizzes
    ] = await Promise.all([
      // Total active quizzes
      Quiz.countDocuments(quizFilter),

      // Total quiz attempts in time range
      QuizAttempt.countDocuments(attemptFilter),

      // Average score
      QuizAttempt.aggregate([
        { $match: attemptFilter },
        {
          $group: {
            _id: null,
            avgScore: { $avg: '$scorePercentage' }
          }
        }
      ]),

      // Category stats
      Quiz.aggregate([
        { $match: quizFilter },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $group: {
            _id: '$category',
            categoryName: { $first: '$categoryInfo.name' },
            quizCount: { $sum: 1 },
            avgTimeLimit: { $avg: '$timeLimit' },
            avgTotalMarks: { $avg: '$totalMarks' }
          }
        }
      ]),

      // Difficulty stats
      Quiz.aggregate([
        { $match: quizFilter },
        {
          $group: {
            _id: '$difficulty',
            count: { $sum: 1 },
            avgTimeLimit: { $avg: '$timeLimit' },
            avgTotalMarks: { $avg: '$totalMarks' }
          }
        }
      ]),

      // ✅ Level stats with levelName (e.g. "Level 1")
      Quiz.aggregate([
        { $match: quizFilter },
        {
          $group: {
            _id: '$requiredLevel',
            count: { $sum: 1 }
          }
        },
        {
          $addFields: {
            levelName: {
              $concat: ['Level ', { $toString: '$_id' }]
            }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Top 10 most attempted quizzes
      QuizAttempt.aggregate([
        { $match: attemptFilter },
        {
          $lookup: {
            from: 'quizzes',
            localField: 'quiz',
            foreignField: '_id',
            as: 'quizInfo'
          }
        },
        {
          $group: {
            _id: '$quiz',
            quizTitle: { $first: '$quizInfo.title' },
            attemptCount: { $sum: 1 },
            avgScore: { $avg: '$scorePercentage' },
            maxScore: { $max: '$scorePercentage' },
            minScore: { $min: '$scorePercentage' }
          }
        },
        { $sort: { attemptCount: -1 } },
        { $limit: 10 }
      ]),

      // Performance grouped by quiz and difficulty
      QuizAttempt.aggregate([
        { $match: attemptFilter },
        {
          $lookup: {
            from: 'quizzes',
            localField: 'quiz',
            foreignField: '_id',
            as: 'quizInfo'
          }
        },
        {
          $group: {
            _id: {
              quiz: '$quiz',
              difficulty: '$quizInfo.difficulty'
            },
            avgScore: { $avg: '$scorePercentage' },
            attemptCount: { $sum: 1 },
            completionRate: {
              $avg: {
                $cond: [{ $gte: ['$scorePercentage', 0] }, 1, 0]
              }
            }
          }
        }
      ]),

      // Recent quizzes
      Quiz.find(quizFilter)
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalQuizzes,
          totalAttempts,
          avgScore: avgScore[0]?.avgScore || 0,
          period
        },
        categoryStats,
        difficultyStats,
        levelStats,
        topQuizzes,
        quizPerformance,
        recentQuizzes
      }
    });
  } catch (error) {
    console.error('Error fetching quiz analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz analytics',
      error: error.message
    });
  }
};


// Financial Analytics
exports.getFinancialAnalytics = async (req, res) => {
  try {
    const { period = 'current-month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const [
      totalRevenue,
      periodRevenue,
      subscriptionStats,
      paymentStats,
      revenueTrend,
      planDistribution,
      topRevenuePlans
    ] = await Promise.all([
      PaymentOrder.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      PaymentOrder.aggregate([
        { 
          $match: { 
            status: 'paid',
            createdAt: { $gte: startDate, $lte: endDate }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Subscription.aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: '$plan',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]),
      PaymentOrder.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]),
      PaymentOrder.aggregate([
        { $match: { status: 'paid' } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      User.aggregate([
        { $match: { role: 'student' } },
        {
          $group: {
            _id: '$subscriptionStatus',
            count: { $sum: 1 }
          }
        }
      ]),
      PaymentOrder.aggregate([
        { $match: { status: 'paid' } },
        {
          $lookup: {
            from: 'subscriptions',
            localField: 'subscriptionId',
            foreignField: '_id',
            as: 'subscriptionInfo'
          }
        },
        {
          $group: {
            _id: '$subscriptionInfo.plan',
            totalRevenue: { $sum: '$amount' },
            count: { $sum: 1 },
            avgAmount: { $avg: '$amount' }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalRevenue: totalRevenue[0]?.total || 0,
          periodRevenue: periodRevenue[0]?.total || 0,
          period
        },
        subscriptionStats,
        paymentStats,
        revenueTrend,
        planDistribution,
        topRevenuePlans
      }
    });
  } catch (error) {
    console.error('Error fetching financial analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch financial analytics',
      error: error.message
    });
  }
};

// Performance Analytics
exports.getPerformanceAnalytics = async (req, res) => {
  try {
    const { period = 'current-month' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    
    // Get current month for monthly progress data
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    const [
      leaderboardStats,
      topPerformers,
      scoreDistribution,
      levelPerformance,
      categoryPerformance,
      timeAnalysis
    ] = await Promise.all([
      Leaderboard.aggregate([
        {
          $group: {
            _id: '$quiz',
            totalEntries: { $sum: 1 },
            avgScore: { $avg: '$entries.score' },
            maxScore: { $max: '$entries.score' },
            minScore: { $min: '$entries.score' }
          }
        },
        { $sort: { totalEntries: -1 } },
        { $limit: 10 }
      ]),
      // Get top performers based on monthly progress data (fallback to level data if available)
      User.find({ 
        role: 'student',
        'monthlyProgress.month': currentMonth // Only get users with current month data
      })
        .sort({ 
          'monthlyProgress.highScoreWins': -1, 
          'monthlyProgress.accuracy': -1, 
          'monthlyProgress.totalQuizAttempts': -1,
          'level.averageScore': -1
        })
        .limit(20)
        .select('name email level monthlyProgress subscriptionStatus')
        .lean(),
      QuizAttempt.aggregate([
        { $match: { attemptedAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ['$scorePercentage', 40] }, then: '0-40%' },
                  { case: { $lt: ['$scorePercentage', 60] }, then: '40-60%' },
                  { case: { $lt: ['$scorePercentage', 75] }, then: '60-75%' },
                  { case: { $lt: ['$scorePercentage', 100] }, then: '75-100%' }
                ],
                default: '100%'
              }
            },
            count: { $sum: 1 },
            avgScore: { $avg: '$scorePercentage' }
          }
        }
      ]),
      // Use level data for level performance
      User.aggregate([
        { 
          $match: { 
            role: 'student'
          } 
        },
        {
          $group: {
            _id: '$level.currentLevel',
            userCount: { $sum: 1 },
            avgScore: { $avg: '$level.averageScore' },
            avgQuizzes: { $avg: '$level.quizzesPlayed' },
            avgHighScores: { $avg: '$level.highScoreQuizzes' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      QuizAttempt.aggregate([
        { $match: { attemptedAt: { $gte: startDate, $lte: endDate } } },
        {
          $lookup: {
            from: 'quizzes',
            localField: 'quiz',
            foreignField: '_id',
            as: 'quizInfo'
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'quizInfo.category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $group: {
            _id: '$categoryInfo.name',
            avgScore: { $avg: '$scorePercentage' },
            attemptCount: { $sum: 1 },
            completionRate: {
              $avg: {
                $cond: [{ $gte: ['$scorePercentage', 0] }, 1, 0]
              }
            }
          }
        }
      ]),
      QuizAttempt.aggregate([
        { $match: { attemptedAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: {
              hour: { $hour: '$attemptedAt' },
              dayOfWeek: { $dayOfWeek: '$attemptedAt' }
            },
            attemptCount: { $sum: 1 },
            avgScore: { $avg: '$scorePercentage' }
          }
        },
        { $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 } }
      ])
    ]);

    //console.log('🔍 Debug - Raw top performer data:', JSON.stringify(topPerformers[0], null, 2));
    //console.log('🔍 Debug - Raw monthly progress data:', JSON.stringify(topPerformers[0]?.monthlyProgress, null, 2));

    // Format top performers to use level data as primary, monthly progress as fallback
    const formattedTopPerformers = topPerformers.map(user => {
      const monthlyData = user.monthlyProgress || {};
      const levelData = user.level || {};
      
      return {
        ...user,
        level: {
          currentLevel: levelData.currentLevel || monthlyData.currentLevel || 0,
          levelName: levelData.currentLevel === 10 ? 'Legend' : getLevelName(levelData.currentLevel || monthlyData.currentLevel || 0),
          highScoreQuizzes: levelData.highScoreQuizzes || monthlyData.highScoreWins || 0,
          quizzesPlayed: levelData.quizzesPlayed || monthlyData.totalQuizAttempts || 0,
          accuracy: monthlyData.accuracy || levelData.averageScore || 0, // Prioritize monthly accuracy
          averageScore: monthlyData.accuracy || levelData.averageScore || 0, // Use monthly accuracy for average score too
          totalScore: levelData.totalScore || monthlyData.totalScore || 0
        }
      };
    });
    // If we don't have enough users with monthly progress, add fallback users
    if (formattedTopPerformers.length < 10) {
      const fallbackUsers = await User.find({ 
        role: 'student',
        'monthlyProgress.month': { $ne: currentMonth } // Users without current month data
      })
        .sort({ 'level.highScoreQuizzes': -1, 'level.averageScore': -1, 'level.quizzesPlayed': -1, 'level.totalScore': -1 })
        .limit(20 - formattedTopPerformers.length)
        .select('name email level monthlyProgress subscriptionStatus')
        .lean();

      const formattedFallbackUsers = fallbackUsers.map(user => {
        const levelData = user.level || {};
        return {
          ...user,
          level: {
            currentLevel: levelData.currentLevel || 0,
            levelName: levelData.currentLevel === 10 ? 'Legend' : getLevelName(levelData.currentLevel || 0),
            highScoreQuizzes: levelData.highScoreQuizzes || 0,
            quizzesPlayed: levelData.quizzesPlayed || 0,
            accuracy: levelData.averageScore || 0, // Use level data for fallback users
            averageScore: levelData.averageScore || 0,
            totalScore: levelData.totalScore || 0
          }
        };
      });

      formattedTopPerformers.push(...formattedFallbackUsers);
    }

    res.json({
      success: true,
      data: {
        leaderboardStats,
        topPerformers: formattedTopPerformers,
        scoreDistribution,
        levelPerformance,
        categoryPerformance,
        timeAnalysis,
        period
      }
    });
  } catch (error) {
    console.error('Error fetching performance analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance analytics',
      error: error.message
    });
  }
};

// Individual User Analytics
exports.getUserPerformanceAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = 'current-month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const [
      userAttempts,
      levelProgress,
      categoryPerformance,
      timeAnalysis,
      comparisonStats
    ] = await Promise.all([
      QuizAttempt.find({ 
        user: userId,
        attemptedAt: { $gte: startDate, $lte: endDate }
      })
        .populate('quiz', 'title category difficulty')
        .sort({ attemptedAt: -1 }),
      User.aggregate([
        { $match: { role: 'student' } },
        {
          $group: {
            _id: null,
            avgLevel: { $avg: '$level.currentLevel' },
            avgScore: { $avg: '$level.averageScore' },
            avgQuizzes: { $avg: '$level.quizzesPlayed' },
            avgHighScores: { $avg: '$level.highScoreQuizzes' }
          }
        }
      ]),
      QuizAttempt.aggregate([
      { $match: { user: user._id } },
      {
        $lookup: {
          from: 'quizzes',
          localField: 'quiz',
          foreignField: '_id',
          as: 'quizInfo'
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'quizInfo.category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $group: {
            _id: '$categoryInfo.name',
            attemptCount: { $sum: 1 },
          avgScore: { $avg: '$scorePercentage' },
          bestScore: { $max: '$scorePercentage' },
            lastAttempt: { $max: '$attemptedAt' }
          }
        }
      ]),
      QuizAttempt.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: {
              hour: { $hour: '$attemptedAt' },
              dayOfWeek: { $dayOfWeek: '$attemptedAt' }
            },
            attemptCount: { $sum: 1 },
            avgScore: { $avg: '$scorePercentage' }
          }
        }
      ]),
      User.aggregate([
        { $match: { role: 'student' } },
        {
          $addFields: {
            scoreRank: {
              $rank: {
                sortBy: { 'level.averageScore': -1 },
                output: { $sum: 1 }
              }
            },
            levelRank: {
              $rank: {
                sortBy: { 'level.currentLevel': -1 },
                output: { $sum: 1 }
              }
            }
          }
        },
        { $match: { _id: user._id } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        user,
        userAttempts,
        levelProgress: levelProgress[0] || {},
        categoryPerformance,
        timeAnalysis,
        comparisonStats: comparisonStats[0] || {},
        period
      }
    });
  } catch (error) {
    console.error('Error fetching user performance analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user performance analytics',
      error: error.message
    });
  }
}; 

// Monthly Progress Analytics
exports.getMonthlyProgressAnalytics = async (req, res) => {
  try {
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM

    const [
      monthlyStats,
      levelDistribution,
      topPerformers,
      rewardEligibleUsers,
      accuracyDistribution,
      quizAttemptsTrend
    ] = await Promise.all([
      // Overall monthly statistics
      User.aggregate([
        { 
          $match: { 
            role: 'student',
            'monthlyProgress.month': currentMonth
          } 
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            avgHighScoreWins: { $avg: '$monthlyProgress.highScoreWins' },
            avgAccuracy: { $avg: '$monthlyProgress.accuracy' },
            avgCurrentLevel: { $avg: '$monthlyProgress.currentLevel' },
            totalQuizAttempts: { $sum: '$monthlyProgress.totalQuizAttempts' },
            totalHighScoreWins: { $sum: '$monthlyProgress.highScoreWins' },
            usersAtLevel10: { $sum: { $cond: [{ $eq: ['$monthlyProgress.currentLevel', 10] }, 1, 0] } },
            eligibleForRewards: { $sum: { $cond: [{ $eq: ['$monthlyProgress.rewardEligible', true] }, 1, 0] } }
          }
        }
      ]),
      // Monthly level distribution
      User.aggregate([
        { 
          $match: { 
            role: 'student',
            'monthlyProgress.month': currentMonth
          } 
        },
        {
          $group: {
            _id: '$monthlyProgress.currentLevel',
            count: { $sum: 1 },
            avgHighScoreWins: { $avg: '$monthlyProgress.highScoreWins' },
            avgAccuracy: { $avg: '$monthlyProgress.accuracy' },
            avgQuizAttempts: { $avg: '$monthlyProgress.totalQuizAttempts' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Top performers for the month
      User.find({ 
        role: 'student',
        'monthlyProgress.month': currentMonth
      })
        .sort({ 'monthlyProgress.highScoreWins': -1, 'monthlyProgress.accuracy': -1 })
        .limit(20)
        .select('name monthlyProgress subscriptionStatus')
        .lean(),
      // Users eligible for monthly rewards
      User.find({ 
        role: 'student',
        'monthlyProgress.month': currentMonth,
        'monthlyProgress.rewardEligible': true
      })
        .sort({ 'monthlyProgress.highScoreWins': -1, 'monthlyProgress.accuracy': -1 })
        .select('name monthlyProgress subscriptionStatus')
        .lean(),
      // Accuracy distribution
      User.aggregate([
        { 
          $match: { 
            role: 'student',
            'monthlyProgress.month': currentMonth,
            'monthlyProgress.accuracy': { $gte: 0 }
          } 
        },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ['$monthlyProgress.accuracy', 25] }, then: '0-25%' },
                  { case: { $lt: ['$monthlyProgress.accuracy', 50] }, then: '25-50%' },
                  { case: { $lt: ['$monthlyProgress.accuracy', 75] }, then: '50-75%' },
                  { case: { $lt: ['$monthlyProgress.accuracy', 100] }, then: '75-100%' }
                ],
                default: '100%'
              }
            },
            count: { $sum: 1 },
            avgHighScoreWins: { $avg: '$monthlyProgress.highScoreWins' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Quiz attempts trend for the month
      QuizAttempt.aggregate([
        { 
          $match: { 
            attemptedAt: { 
              $gte: new Date(currentMonth + '-01'),
              $lt: new Date(new Date(currentMonth + '-01').setMonth(new Date(currentMonth + '-01').getMonth() + 1))
            }
          } 
        },
        {
          $group: {
            _id: {
              day: { $dayOfMonth: '$attemptedAt' },
              hour: { $hour: '$attemptedAt' }
            },
            attemptCount: { $sum: 1 },
            avgScore: { $avg: '$scorePercentage' }
          }
        },
        { $sort: { '_id.day': 1, '_id.hour': 1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        month: currentMonth,
        overview: monthlyStats[0] || {
          totalUsers: 0,
          avgHighScoreWins: 0,
          avgAccuracy: 0,
          avgCurrentLevel: 0,
          totalQuizAttempts: 0,
          totalHighScoreWins: 0,
          usersAtLevel10: 0,
          eligibleForRewards: 0
        },
        levelDistribution,
        topPerformers: topPerformers.map(user => ({
          name: user.name,
          subscriptionStatus: user.subscriptionStatus,
          monthly: user.monthlyProgress
        })),
        rewardEligibleUsers: rewardEligibleUsers.map(user => ({
          name: user.name,
          subscriptionStatus: user.subscriptionStatus,
          monthly: user.monthlyProgress
        })),
        accuracyDistribution,
        quizAttemptsTrend
      }
    });
  } catch (error) {
    console.error('Error fetching monthly progress analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly progress analytics',
      error: error.message
    });
  }
}; 