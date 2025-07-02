const User = require('../models/User');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Question = require('../models/Question');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Subscription = require('../models/Subscription');
const PaymentOrder = require('../models/PaymentOrder');
const Leaderboard = require('../models/Leaderboard');


// Helper function to get date range
const getDateRange = (period = 'month') => {
  const now = new Date();
  const startDate = new Date();
  
  switch (period) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(now.getMonth() - 1);
  }
  
  return { startDate, endDate: now };
};

// Dashboard Overview Analytics
exports.getDashboardOverview = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
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

    // Get top performing users
    const topUsers = await User.find({ role: 'student' })
      .sort({ 'level.highScoreQuizzes': -1, 'level.averageScore': -1 })
      .limit(10)
      .select('name level badges subscriptionStatus');

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
        topUsers
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
    const { period = 'month', level, subscription, dateRange } = req.query;
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
        .select('name level badges subscriptionStatus createdAt'),
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
        topPerformers,
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
    const { period = 'month', category, difficulty } = req.query;
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
      topQuizzes,
      quizPerformance,
      recentQuizzes
    ] = await Promise.all([
      Quiz.countDocuments(quizFilter),
      QuizAttempt.countDocuments(attemptFilter),
      QuizAttempt.aggregate([
        { $match: attemptFilter },
        { $group: { _id: null, avgScore: { $avg: '$scorePercentage' } } }
      ]),
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
    const { period = 'month' } = req.query;
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
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

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
      User.find({ role: 'student' })
        .sort({ 'level.highScoreQuizzes': -1, 'level.averageScore': -1 })
        .limit(20)
        .select('name level badges subscriptionStatus'),
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
      User.aggregate([
        { $match: { role: 'student' } },
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

    res.json({
      success: true,
      data: {
        leaderboardStats,
        topPerformers,
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
    const { period = 'month' } = req.query;
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