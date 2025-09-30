const User = require('../models/User');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const MonthlyWinners = require('../models/MonthlyWinners');

// Dashboard overview analytics
exports.getDashboardOverview = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'student' });
    const totalQuizzes = await Quiz.countDocuments();
    const totalAttempts = await QuizAttempt.countDocuments();
    const totalCategories = await Category.countDocuments();
    const totalSubcategories = await Subcategory.countDocuments();

    // Get active users (users who have attempted quizzes in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = await QuizAttempt.distinct('user', {
      attemptedAt: { $gte: thirtyDaysAgo }
    });

    // Get total revenue from subscriptions (mock calculation)
    const subscriptionRevenue = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ['$subscriptionStatus', 'basic'] }, then: 99 },
                  { case: { $eq: ['$subscriptionStatus', 'premium'] }, then: 199 },
                  { case: { $eq: ['$subscriptionStatus', 'pro'] }, then: 299 }
                ],
                default: 0
              }
            }
          }
        }
      }
    ]);

    // Get total subscriptions count
    const totalSubscriptions = await User.countDocuments({ 
      role: 'student', 
      subscriptionStatus: { $in: ['basic', 'premium', 'pro'] } 
    });

    // Get recent activity (quiz attempts)
    const recentActivity = await QuizAttempt.find()
      .populate('user', 'name')
      .populate('quiz', 'title')
      .sort({ attemptedAt: -1 })
      .limit(20)
      .select('score scorePercentage attemptedAt');

    // Get subscription distribution
    const subscriptionDistribution = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$subscriptionStatus', count: { $sum: 1 } } }
    ]);

    // Get level distribution
    const levelDistribution = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$level.currentLevel', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Get top users based on monthly progress
    const currentMonth = new Date().toISOString().slice(0, 7);
    const topUsers = await User.find({
      role: 'student',
      'monthlyProgress.month': currentMonth
    })
    .select('name level monthlyProgress')
    .sort({ 'monthlyProgress.highScoreWins': -1, 'monthlyProgress.accuracy': -1 })
    .limit(10);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalQuizzes,
          totalAttempts,
          totalRevenue: subscriptionRevenue[0]?.totalRevenue || 0,
          activeUsers: activeUsers.length,
          totalSubscriptions
        },
        recentActivity,
        subscriptionDistribution,
        levelDistribution,
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

// User analytics
exports.getUserAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    
    // Handle different period formats
    let days;
    if (period === 'week') {
      days = 7;
    } else if (period === 'month') {
      days = 30;
    } else if (period === 'quarter') {
      days = 90;
    } else if (period === 'year') {
      days = 365;
    } else {
      days = parseInt(period) || 30;
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // User registration trends (userGrowth)
    const userGrowth = await User.aggregate([
      { $match: { role: 'student', createdAt: { $gte: startDate } } },
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
    ]);

    // Active users (users who attempted quizzes)
    const activeUsers = await QuizAttempt.distinct('user', {
      attemptedAt: { $gte: startDate }
    });

    // Level distribution
    const levelDistribution = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$level.currentLevel', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Subscription stats
    const subscriptionStats = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$subscriptionStatus', count: { $sum: 1 } } }
    ]);

    // Top performers (engagement stats)
    const topPerformers = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $project: {
          name: 1,
          email: 1,
          subscriptionStatus: 1,
          level: 1,
          quizAttempts: { $size: '$quizBestScores' },
          highScoreQuizzes: '$level.highScoreQuizzes',
          averageScore: '$level.averageScore',
          lastActivity: { $max: '$quizBestScores.lastAttemptDate' }
        }
      },
      { $sort: { quizAttempts: -1, highScoreQuizzes: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        userGrowth,
        activeUsers: activeUsers.length,
        levelDistribution,
        subscriptionStats,
        topPerformers
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

// Quiz analytics
exports.getQuizAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    
    // Handle different period formats
    let days;
    if (period === 'week') {
      days = 7;
    } else if (period === 'month') {
      days = 30;
    } else if (period === 'quarter') {
      days = 90;
    } else if (period === 'year') {
      days = 365;
    } else {
      days = parseInt(period) || 30;
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Quiz performance metrics
    const quizStats = await QuizAttempt.aggregate([
      { $match: { attemptedAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$quiz',
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$scorePercentage' },
          highScoreAttempts: {
            $sum: { $cond: [{ $gte: ['$scorePercentage', 75] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'quizzes',
          localField: '_id',
          foreignField: '_id',
          as: 'quizInfo'
        }
      },
      { $unwind: '$quizInfo' },
      {
        $project: {
          quizTitle: '$quizInfo.title',
          totalAttempts: 1,
          averageScore: { $round: ['$averageScore', 2] },
          highScoreAttempts: 1,
          highScoreRate: {
            $round: [
              { $multiply: [{ $divide: ['$highScoreAttempts', '$totalAttempts'] }, 100] },
              2
            ]
          }
        }
      },
      { $sort: { totalAttempts: -1 } },
      { $limit: 20 }
    ]);

    // Category performance
    const categoryStats = await QuizAttempt.aggregate([
      { $match: { attemptedAt: { $gte: startDate } } },
      {
        $lookup: {
          from: 'quizzes',
          localField: 'quiz',
          foreignField: '_id',
          as: 'quizInfo'
        }
      },
      { $unwind: '$quizInfo' },
      {
        $lookup: {
          from: 'categories',
          localField: 'quizInfo.category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      {
        $group: {
          _id: '$categoryInfo._id',
          categoryName: { $first: '$categoryInfo.name' },
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$scorePercentage' }
        }
      },
      {
        $project: {
          categoryName: 1,
          totalAttempts: 1,
          averageScore: { $round: ['$averageScore', 2] }
        }
      },
      { $sort: { totalAttempts: -1 } }
    ]);

    // Get recent quizzes
    const recentQuizzes = await Quiz.find()
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title category subcategory difficulty createdAt');

    // Get overview stats
    const totalQuizzes = await Quiz.countDocuments();
    const totalAttempts = await QuizAttempt.countDocuments();
    const avgScore = await QuizAttempt.aggregate([
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$scorePercentage' }
        }
      }
    ]);

    // Get difficulty stats
    const difficultyStats = await Quiz.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);

    // Get level stats (quiz attempts by level)
    const levelStats = await QuizAttempt.aggregate([
      { $match: { attemptedAt: { $gte: startDate } } },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      { $group: { _id: '$userInfo.level.currentLevel', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        topQuizzes: quizStats,
        recentQuizzes,
        categoryStats,
        difficultyStats,
        levelStats,
        overview: {
          totalQuizzes,
          totalAttempts,
          avgScore: avgScore[0]?.avgScore || 0
        }
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

// Financial analytics
exports.getFinancialAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    
    // Handle different period formats
    let days;
    if (period === 'week') {
      days = 7;
    } else if (period === 'month') {
      days = 30;
    } else if (period === 'quarter') {
      days = 90;
    } else if (period === 'year') {
      days = 365;
    } else {
      days = parseInt(period) || 30;
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Subscription revenue (mock data - replace with actual subscription model)
    const subscriptionStats = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $group: {
          _id: '$subscriptionStatus',
          count: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ['$subscriptionStatus', 'basic'] }, then: 99 },
                  { case: { $eq: ['$subscriptionStatus', 'premium'] }, then: 199 },
                  { case: { $eq: ['$subscriptionStatus', 'pro'] }, then: 299 }
                ],
                default: 0
              }
            }
          }
        }
      }
    ]);

    // Monthly winners payout
    const monthlyWinners = await MonthlyWinners.find()
      .sort({ monthYear: -1 })
      .limit(12);

    const totalPayouts = monthlyWinners.reduce((sum, month) => {
      return sum + month.winners.reduce((monthSum, winner) => {
        return monthSum + winner.rewardAmount;
      }, 0);
    }, 0);

    // Calculate total revenue
    const totalRevenue = subscriptionStats.reduce((sum, stat) => sum + stat.totalRevenue, 0);
    
    // Calculate period revenue (revenue from last period)
    const periodRevenue = subscriptionStats.reduce((sum, stat) => {
      // Mock calculation - in real app, filter by date
      return sum + (stat.totalRevenue * 0.3); // Assume 30% is from current period
    }, 0);

    // Plan distribution (same as subscription stats)
    const planDistribution = subscriptionStats;

    // Top revenue plans (same as subscription stats sorted by revenue)
    const topRevenuePlans = subscriptionStats.sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Revenue trend (mock data - in real app, get monthly revenue data)
    const revenueTrend = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      revenueTrend.push({
        _id: {
          year: date.getFullYear(),
          month: date.getMonth() + 1
        },
        revenue: Math.floor(totalRevenue * (0.8 + Math.random() * 0.4)) // Mock trend
      });
    }

    // Payment stats (mock data - in real app, get actual payment data)
    const paymentStats = [
      { _id: 'successful', count: Math.floor(subscriptionStats.length * 0.85) },
      { _id: 'failed', count: Math.floor(subscriptionStats.length * 0.10) },
      { _id: 'pending', count: Math.floor(subscriptionStats.length * 0.05) }
    ];

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        topRevenuePlans,
        planDistribution,
        revenueTrend,
        paymentStats,
        subscriptionStats,
        overview: {
          totalRevenue,
          periodRevenue,
          totalPayouts
        },
        monthlyWinners: monthlyWinners.length,
        recentWinners: monthlyWinners.slice(0, 6)
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

// Performance analytics
exports.getPerformanceAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    
    // Handle different period formats
    let days;
    if (period === 'week') {
      days = 7;
    } else if (period === 'month') {
      days = 30;
    } else if (period === 'quarter') {
      days = 90;
    } else if (period === 'year') {
      days = 365;
    } else {
      days = parseInt(period) || 30;
    }
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Overall performance metrics
    const performanceStats = await QuizAttempt.aggregate([
      { $match: { attemptedAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$scorePercentage' },
          highScoreAttempts: {
            $sum: { $cond: [{ $gte: ['$scorePercentage', 75] }, 1, 0] }
          },
          perfectScores: {
            $sum: { $cond: [{ $eq: ['$scorePercentage', 100] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          totalAttempts: 1,
          averageScore: { $round: ['$averageScore', 2] },
          highScoreAttempts: 1,
          highScoreRate: {
            $round: [
              { $multiply: [{ $divide: ['$highScoreAttempts', '$totalAttempts'] }, 100] },
              2
            ]
          },
          perfectScores: 1,
          perfectScoreRate: {
            $round: [
              { $multiply: [{ $divide: ['$perfectScores', '$totalAttempts'] }, 100] },
              2
            ]
          }
        }
      }
    ]);

    // Top performers - use monthlyProgress data when period is month
    let topPerformers;
    if (period === 'month') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      topPerformers = await User.find({
        role: 'student',
        'monthlyProgress.month': currentMonth
      })
      .select('name email level monthlyProgress')
      .sort({ 'monthlyProgress.highScoreWins': -1, 'monthlyProgress.accuracy': -1 })
      .limit(10)
      .lean();
      
      // Calculate total scores for each user from quiz attempts
      const userIds = topPerformers.map(user => user._id);
      const totalScores = await QuizAttempt.aggregate([
        { $match: { user: { $in: userIds } } },
        {
          $group: {
            _id: '$user',
            totalScore: { $sum: '$score' },
            totalCorrectAnswers: { $sum: '$correctAnswers' }
          }
        }
      ]);
      
      // Create a map for quick lookup
      const scoreMap = {};
      totalScores.forEach(score => {
        scoreMap[score._id.toString()] = {
          totalScore: score.totalScore,
          totalCorrectAnswers: score.totalCorrectAnswers
        };
      });
      
      // Transform the data to match frontend expectations
      topPerformers = topPerformers.map(user => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        level: {
          currentLevel: user.level?.currentLevel || 0,
          levelName: user.level?.currentLevel === 10 ? 'Legend' : 
                    user.level?.currentLevel === 9 ? 'Master' :
                    user.level?.currentLevel === 8 ? 'Expert' :
                    user.level?.currentLevel === 7 ? 'Advanced' :
                    user.level?.currentLevel === 6 ? 'Intermediate' :
                    user.level?.currentLevel === 5 ? 'Skilled' :
                    user.level?.currentLevel === 4 ? 'Competent' :
                    user.level?.currentLevel === 3 ? 'Novice' :
                    user.level?.currentLevel === 2 ? 'Beginner' :
                    user.level?.currentLevel === 1 ? 'Starter' : 'No Level',
          highScoreQuizzes: user.monthlyProgress?.highScoreWins || 0,
          quizzesPlayed: user.monthlyProgress?.totalQuizAttempts || 0,
          accuracy: user.monthlyProgress?.accuracy || 0,
          averageScore: user.monthlyProgress?.accuracy || 0,
          totalScore: scoreMap[user._id.toString()]?.totalScore || 0
        },
        monthlyProgress: {
          highScoreWins: user.monthlyProgress?.highScoreWins || 0,
          accuracy: user.monthlyProgress?.accuracy || 0,
          totalQuizAttempts: user.monthlyProgress?.totalQuizAttempts || 0,
          month: user.monthlyProgress?.month,
          currentLevel: user.monthlyProgress?.currentLevel || user.level?.currentLevel || 0,
          rewardEligible: user.monthlyProgress?.rewardEligible || false
        },
        totalScore: scoreMap[user._id.toString()]?.totalScore || 0,
        totalCorrectAnswers: scoreMap[user._id.toString()]?.totalCorrectAnswers || 0
      }));
    } else {
      // For other periods, use the original aggregation logic with total score calculation
      topPerformers = await User.aggregate([
        { $match: { role: 'student' } },
        {
          $lookup: {
            from: 'quizattempts',
            localField: '_id',
            foreignField: 'user',
            as: 'quizAttempts'
          }
        },
        {
          $project: {
            name: 1,
            email: 1,
            level: 1,
            highScoreQuizzes: '$level.highScoreQuizzes',
            accuracy: '$level.averageScore',
            totalQuizzes: { $size: '$quizBestScores' },
            totalScore: { $sum: '$quizAttempts.score' },
            totalCorrectAnswers: { $sum: '$quizAttempts.correctAnswers' }
          }
        },
        { $sort: { highScoreQuizzes: -1, accuracy: -1 } },
        { $limit: 10 }
      ]);
    }

    // Level performance data
    const levelPerformance = await QuizAttempt.aggregate([
      { $match: { attemptedAt: { $gte: startDate } } },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $group: {
          _id: '$userInfo.level.currentLevel',
          avgScore: { $avg: '$scorePercentage' },
          userCount: { $addToSet: '$user' }
        }
      },
      {
        $project: {
          avgScore: { $round: ['$avgScore', 2] },
          userCount: { $size: '$userCount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Score distribution data
    const scoreDistribution = await QuizAttempt.aggregate([
      { $match: { attemptedAt: { $gte: startDate } } },
      {
        $bucket: {
          groupBy: '$scorePercentage',
          boundaries: [0, 25, 50, 75, 90, 100],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            avgScore: { $avg: '$scorePercentage' }
          }
        }
      },
      {
        $project: {
          _id: { $concat: [{ $toString: '$_id.min' }, '-', { $toString: '$_id.max' }, '%'] },
          count: 1,
          avgScore: { $round: ['$avgScore', 2] }
        }
      }
    ]);

    // Category performance data
    const categoryPerformance = await QuizAttempt.aggregate([
      { $match: { attemptedAt: { $gte: startDate } } },
      {
        $lookup: {
          from: 'quizzes',
          localField: 'quiz',
          foreignField: '_id',
          as: 'quizInfo'
        }
      },
      { $unwind: '$quizInfo' },
      {
        $lookup: {
          from: 'categories',
          localField: 'quizInfo.category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      {
        $group: {
          _id: '$categoryInfo._id',
          categoryName: { $first: '$categoryInfo.name' },
          attemptCount: { $sum: 1 },
          avgScore: { $avg: '$scorePercentage' },
          completionRate: {
            $avg: {
              $cond: [{ $gte: ['$scorePercentage', 75] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          categoryName: 1,
          attemptCount: 1,
          avgScore: { $round: ['$avgScore', 2] },
          completionRate: { $round: ['$completionRate', 4] }
        }
      },
      { $sort: { attemptCount: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        performanceStats: performanceStats[0] || {},
        topPerformers,
        levelPerformance,
        scoreDistribution,
        categoryPerformance
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

// Monthly progress analytics
exports.getMonthlyProgressAnalytics = async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Monthly progress stats
    const monthlyStats = await User.aggregate([
      { $match: { role: 'student', 'monthlyProgress.month': currentMonth } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalAttempts: { $sum: '$monthlyProgress.totalQuizAttempts' },
          totalHighScores: { $sum: '$monthlyProgress.highScoreWins' },
          averageAccuracy: { $avg: '$monthlyProgress.accuracy' },
          eligibleUsers: {
            $sum: { $cond: ['$monthlyProgress.rewardEligible', 1, 0] }
          }
        }
      }
    ]);

    // Level distribution for current month
    const levelDistribution = await User.aggregate([
      { $match: { role: 'student', 'monthlyProgress.month': currentMonth } },
      {
        $group: {
          _id: '$monthlyProgress.currentLevel',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top performers for current month
    const monthlyTopPerformers = await User.find({
      role: 'student',
      'monthlyProgress.month': currentMonth,
      'monthlyProgress.rewardEligible': true
    })
    .select('name monthlyProgress level')
    .sort({ 'monthlyProgress.highScoreWins': -1, 'monthlyProgress.accuracy': -1 })
    .limit(10);

    res.json({
      success: true,
      data: {
        month: currentMonth,
        monthlyStats: monthlyStats[0] || {},
        levelDistribution,
        topPerformers: monthlyTopPerformers
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

// Individual user performance analytics
exports.getUserPerformanceAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // User's quiz attempts
    const userAttempts = await QuizAttempt.find({ user: userId })
      .populate('quiz', 'title category subcategory')
      .sort({ attemptedAt: -1 })
      .limit(50);

    // Performance over time
    const performanceOverTime = await QuizAttempt.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: {
            year: { $year: '$attemptedAt' },
            month: { $month: '$attemptedAt' },
            day: { $dayOfMonth: '$attemptedAt' }
          },
          averageScore: { $avg: '$scorePercentage' },
          totalAttempts: { $sum: 1 },
          highScores: {
            $sum: { $cond: [{ $gte: ['$scorePercentage', 75] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Category performance
    const categoryPerformance = await QuizAttempt.aggregate([
      { $match: { user: userId } },
      {
        $lookup: {
          from: 'quizzes',
          localField: 'quiz',
          foreignField: '_id',
          as: 'quizInfo'
        }
      },
      { $unwind: '$quizInfo' },
      {
        $lookup: {
          from: 'categories',
          localField: 'quizInfo.category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      {
        $group: {
          _id: '$categoryInfo._id',
          categoryName: { $first: '$categoryInfo.name' },
          totalAttempts: { $sum: 1 },
          averageScore: { $avg: '$scorePercentage' },
          highScores: {
            $sum: { $cond: [{ $gte: ['$scorePercentage', 75] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          categoryName: 1,
          totalAttempts: 1,
          averageScore: { $round: ['$averageScore', 2] },
          highScores: 1,
          highScoreRate: {
            $round: [
              { $multiply: [{ $divide: ['$highScores', '$totalAttempts'] }, 100] },
              2
            ]
          }
        }
      },
      { $sort: { totalAttempts: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          level: user.level,
          monthlyProgress: user.monthlyProgress
        },
        recentAttempts: userAttempts,
        performanceOverTime,
        categoryPerformance
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
