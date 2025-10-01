const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const Article = require('../models/Article');
const dayjs = require('dayjs');

// GET /api/public/categories - Public categories API
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({});
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: err.message });
  }
};

// GET /api/public/top-performers - Public top performers API for students (monthly based)
exports.getTopPerformers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const currentUserId = req.user.id; // Get current user ID from auth middleware (optional)
    const month = dayjs().format('YYYY-MM'); // Current month
    
    // First, try to get users with monthly progress for current month
    let allUsers = await User.find({ 
      role: 'student',
      'monthlyProgress.month': month
    })
      .select('_id name monthlyProgress createdAt subscriptionStatus')
      .lean();

    // If we don't have enough users with current month data, get additional users with global level data
    if (allUsers.length < parseInt(limit)) {
      const additionalUsers = await User.find({ 
        role: 'student',
        $or: [
          { 'monthlyProgress.month': { $ne: month } },
          { monthlyProgress: { $exists: false } }
        ]
      })
        .select('_id name level createdAt subscriptionStatus')
        .sort({ 'level.highScoreQuizzes': -1, 'level.averageScore': -1 })
        .limit(parseInt(limit) - allUsers.length)
        .lean();

      // Transform additional users to match monthly progress format
      const transformedAdditionalUsers = additionalUsers.map(user => ({
        _id: user._id,
        name: user.name,
        subscriptionStatus: user.subscriptionStatus,
        monthlyProgress: {
          month: month,
          highScoreWins: user.level?.highScoreQuizzes || 0,
          totalQuizAttempts: user.level?.quizzesPlayed || 0,
          accuracy: user.level?.averageScore || 0,
          currentLevel: user.level?.currentLevel || 0,
          rewardEligible: false
        },
        createdAt: user.createdAt
      }));

      allUsers = [...allUsers, ...transformedAdditionalUsers];
    }

    // Ensure all users have monthly progress data, set defaults if missing
    allUsers.forEach(user => {
      if (!user.monthlyProgress) {
        user.monthlyProgress = {
          month: month,
          highScoreWins: 0,
          totalQuizAttempts: 0,
          accuracy: 0,
          currentLevel: 0,
          rewardEligible: false
        };
      }
    });

    // Custom sorting: First by monthly high score wins (descending), then by accuracy (descending)
    allUsers.sort((a, b) => {
      const aHighScore = a.monthlyProgress?.highScoreWins || 0;
      const bHighScore = b.monthlyProgress?.highScoreWins || 0;
      const aAccuracy = a.monthlyProgress?.accuracy || 0;
      const bAccuracy = b.monthlyProgress?.accuracy || 0;
      
      // First priority: Monthly high score wins (descending)
      if (aHighScore !== bHighScore) {
        return bHighScore - aHighScore;
      }
      
      // Second priority: Monthly accuracy (descending)
      if (aAccuracy !== bAccuracy) {
        return bAccuracy - aAccuracy;
      }
      
      // Third priority: Total quiz attempts (descending) - same as Performance Analytics
      const aTotalQuizzes = a.monthlyProgress?.totalQuizAttempts || 0;
      const bTotalQuizzes = b.monthlyProgress?.totalQuizAttempts || 0;
      return bTotalQuizzes - aTotalQuizzes;
    });

    // Get top performers
    const topPerformers = allUsers.slice(0, parseInt(limit));

    // Find current user's position and surrounding users
    let currentUserData = null;
    let surroundingUsers = [];
    
    if (currentUserId) {
      const currentUserIndex = allUsers.findIndex(user => user._id.toString() === currentUserId.toString());
      
      if (currentUserIndex !== -1) {
        // Get exactly 3 users: 1 before + current + 1 after (when possible)
        let surroundingUsersList = [];
        
        if (currentUserIndex === 0) {
          // Current user is at position 1, get next 2 users
          surroundingUsersList = allUsers.slice(1, 3);
        } else if (currentUserIndex === allUsers.length - 1) {
          // Current user is at last position, get previous 2 users
          surroundingUsersList = allUsers.slice(currentUserIndex - 2, currentUserIndex);
        } else {
          // Current user is in middle: get 1 before + current + 1 after
          surroundingUsersList = allUsers.slice(currentUserIndex - 1, currentUserIndex + 2);
        }
        
        // Ensure we have exactly 3 users total
        surroundingUsersList = surroundingUsersList.slice(0, 3);
        
        surroundingUsers = surroundingUsersList.map((user, index) => ({
          ...user,
          position: user.position || (allUsers.indexOf(user) + 1),
          isCurrentUser: user._id.toString() === currentUserId.toString()
        }));
        
        // Add current user data separately
        currentUserData = {
          ...allUsers[currentUserIndex],
          position: currentUserIndex + 1,
          isCurrentUser: true
        };
      }
    }

    // Format the data for frontend consumption
    const formatUser = (user, position = null, isCurrentUser = false) => {
      const highScoreWins = user.monthlyProgress?.highScoreWins || 0;
      const totalQuizAttempts = user.monthlyProgress?.totalQuizAttempts || 0;
      const accuracy = user.monthlyProgress?.accuracy || 0;
      const currentLevel = user.monthlyProgress?.currentLevel || 0;
      
      return {
        _id: user._id,
        name: user.name,
        position: position || 0,
        isCurrentUser,
        subscriptionName: getSubscriptionDisplayName(user.subscriptionStatus),
        level: {
          currentLevel,
          levelName: getLevelName(currentLevel),
          highScoreQuizzes: highScoreWins,
          quizzesPlayed: totalQuizAttempts,
          accuracy,
          averageScore: accuracy
        },
        monthly: {
          month: user.monthlyProgress?.month || month,
          highScoreWins,
          totalQuizAttempts,
          accuracy,
          currentLevel,
          rewardEligible: user.monthlyProgress?.rewardEligible || false
        }
      };
    };

    const formattedTopPerformers = topPerformers.map((user, index) => 
      formatUser(user, index + 1, user._id.toString() === currentUserId?.toString())
    );

    const formattedSurroundingUsers = surroundingUsers.map(user => 
      formatUser(user, user.position, user.isCurrentUser)
    );

    const responseData = {
      success: true,
      data: {
        topPerformers: formattedTopPerformers,        // Top users
        currentUser: currentUserData ? formatUser(currentUserData, currentUserData.position, true) : null,  // Current user data with position
        surroundingUsers: formattedSurroundingUsers,  // 1 before + current + 1 after (3 users total)
        month: month,
        total: allUsers.length
      }
    };

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top performers',
      error: error.message
    });
  }
};

// GET /api/public/monthly-leaderboard - Top eligible users for current month
exports.getMonthlyLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 3, 50);
    const month = dayjs().format('YYYY-MM');

    const users = await User.find({
      role: 'student',
      'level.currentLevel': 10,
      'level.highScoreQuizzes': { $gte: parseInt(process.env.MONTHLY_REWARD_QUIZ_REQUIREMENT) || 220 }
    })
    .select('name level monthlyProgress subscriptionStatus')
    .lean();

    // Sort: 1. Highest Average Quiz Score, 2. Highest Accuracy, 3. Total Score, 4. Total Quizzes Played
    users.sort((a, b) => {
      const aAvg = a.level?.averageScore || 0;
      const bAvg = b.level?.averageScore || 0;
      if (aAvg !== bAvg) return bAvg - aAvg;
      
      const aAcc = a.monthlyProgress?.accuracy || 0;
      const bAcc = b.monthlyProgress?.accuracy || 0;
      if (aAcc !== bAcc) return bAcc - aAcc;
      
      const aScore = a.level?.totalScore || 0;
      const bScore = b.level?.totalScore || 0;
      if (aScore !== bScore) return bScore - aScore;
      
      const aQuizzes = a.level?.quizzesPlayed || 0;
      const bQuizzes = b.level?.quizzesPlayed || 0;
      return bQuizzes - aQuizzes;
    });

    const top = users.slice(0, limit).map((u, idx) => ({
      userId: u._id,
      name: u.name,
      rank: idx + 1,
      month,
      level: {
        currentLevel: u.level?.currentLevel || 0,
        highScoreQuizzes: u.level?.highScoreQuizzes || 0,
        averageScore: u.level?.averageScore || 0,
        totalScore: u.level?.totalScore || 0,
        quizzesPlayed: u.level?.quizzesPlayed || 0
      },
      monthly: {
        accuracy: u.monthlyProgress?.accuracy || 0,
        rewardEligible: true // All users in this query are eligible
      }
    }));

    res.json({ success: true, data: { month, top } });
  } catch (error) {
    console.error('Error fetching monthly leaderboard:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monthly leaderboard', error: error.message });
  }
};

// Helper function to get level names
const getLevelName = (level) => {
  const levelNames = {
    0: 'Starter', 1: 'Rookie', 2: 'Explorer', 3: 'Thinker', 4: 'Strategist', 5: 'Achiever',
    6: 'Mastermind', 7: 'Champion', 8: 'Prodigy', 9: 'Wizard', 10: 'Legend'
  };
  return levelNames[level] || 'Unknown';
};

const getSubscriptionDisplayName = (subscriptionStatus) => {
  const subscriptionNames = {
    'free': 'FREE',
    'basic': 'BASIC', 
    'premium': 'PREMIUM',
    'pro': 'PRO'
  };

  return subscriptionNames[subscriptionStatus] || 'FREE';
};

// GET /api/public/top-performers-monthly - Top 10 performers for current month based on performance
exports.getTopPerformersMonthly = async (req, res) => {
  try {
    const month = dayjs().format('YYYY-MM');
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const currentUserId = req.query.userId; // Get current user ID from query parameter

    // First, try to get users with monthly progress for current month
    let users = await User.find({ 
      role: 'student',
      'monthlyProgress.month': month
    })
    .select('_id name monthlyProgress level profilePicture subscriptionStatus')
    .lean();

    // If we don't have enough users with current month data, get additional users with global level data
    if (users.length < limit) {
      const additionalUsers = await User.find({ 
        role: 'student',
        $or: [
          { 'monthlyProgress.month': { $ne: month } },
          { monthlyProgress: { $exists: false } }
        ]
      })
        .select('_id name level profilePicture subscriptionStatus')
        .sort({ 'level.highScoreQuizzes': -1, 'level.averageScore': -1 })
        .limit(limit - users.length)
        .lean();

      // Transform additional users to match monthly progress format
      const transformedAdditionalUsers = additionalUsers.map(user => ({
        _id: user._id,
        name: user.name,
        profilePicture: user.profilePicture,
        subscriptionStatus: user.subscriptionStatus,
        level: user.level,
        monthlyProgress: {
          month: month,
          highScoreWins: user.level?.highScoreQuizzes || 0,
          totalQuizAttempts: user.level?.quizzesPlayed || 0,
          accuracy: user.level?.averageScore || 0,
          currentLevel: user.level?.currentLevel || 0,
          rewardEligible: false
        }
      }));

      users = [...users, ...transformedAdditionalUsers];
    }

    // Ensure all users have monthly progress data, set defaults if missing
    users.forEach(user => {
      if (!user.monthlyProgress) {
        user.monthlyProgress = {
          month: month,
          highScoreWins: 0,
          totalQuizAttempts: 0,
          accuracy: 0,
          currentLevel: 0,
          rewardEligible: false
        };
      }
      // Ensure level data exists
      if (!user.level) {
        user.level = {
          totalScore: 0,
          quizzesPlayed: 0,
          averageScore: 0,
          currentLevel: 0,
          highScoreQuizzes: 0
        };
      }
    });

    // Sort by performance: first by high score wins, then by accuracy, then by total quizzes - same as Performance Analytics
    users.sort((a, b) => {
      const aWins = a.monthlyProgress?.highScoreWins || 0;
      const bWins = b.monthlyProgress?.highScoreWins || 0;
      
      // First priority: High Score Wins (descending) - same as Performance Analytics
      if (aWins !== bWins) return bWins - aWins;
      
      const aAccuracy = a.monthlyProgress?.accuracy || 0;
      const bAccuracy = b.monthlyProgress?.accuracy || 0;
      
      // Second priority: Accuracy (descending) - same as Performance Analytics
      if (aAccuracy !== bAccuracy) return bAccuracy - aAccuracy;
      
      // Third priority: Total quizzes played (descending) - same as Performance Analytics
      const aTotalQuizzes = a.monthlyProgress?.totalQuizAttempts || 0;
      const bTotalQuizzes = b.monthlyProgress?.totalQuizAttempts || 0;
      return bTotalQuizzes - aTotalQuizzes;
    });

    // Add position to each user
    users.forEach((user, index) => {
      user.position = index + 1;
    });

    const top = users.slice(0, limit).map((user, index) => ({
      userId: user._id,
      name: user.name,
      rank: index + 1,
      month: month,
      profilePicture: user.profilePicture,
      subscriptionName: getSubscriptionDisplayName(user.subscriptionStatus),
      totalCorrectAnswers: user.level?.totalScore || 0,
      monthly: {
        highScoreWins: user.monthlyProgress?.highScoreWins || 0,
        totalQuizAttempts: user.monthlyProgress?.totalQuizAttempts || 0,
        accuracy: user.monthlyProgress?.accuracy || 0,
        currentLevel: user.monthlyProgress?.currentLevel || 0,
        rewardEligible: !!user.monthlyProgress?.rewardEligible
      }
    }));

    // Find current user's position and surrounding users
    let currentUserData = null;
    let surroundingUsers = [];
    
    if (currentUserId) {
      const currentUserIndex = users.findIndex(user => user._id.toString() === currentUserId.toString());
      
      if (currentUserIndex !== -1) {
        currentUserData = {
          ...users[currentUserIndex],
          position: users[currentUserIndex].position
        };

        // Get exactly 3 users: 1 before + current + 1 after (when possible)
        let surroundingUsersList = [];
        
        if (currentUserIndex === 0) {
          // Current user is at position 1, get next 2 users
          surroundingUsersList = users.slice(1, 3);
        } else if (currentUserIndex === users.length - 1) {
          // Current user is at last position, get previous 2 users
          surroundingUsersList = users.slice(currentUserIndex - 2, currentUserIndex);
        } else {
          // Current user is in middle: get 1 before + current + 1 after
          surroundingUsersList = users.slice(currentUserIndex - 1, currentUserIndex + 2);
        }
        
        // Ensure we have exactly 3 users total
        surroundingUsersList = surroundingUsersList.slice(0, 3);
        
        surroundingUsers = surroundingUsersList.map((user) => ({
          userId: user._id,
          name: user.name,
          position: user.position,
          isCurrentUser: user._id.toString() === currentUserId.toString(),
          subscriptionName: getSubscriptionDisplayName(user.subscriptionStatus),
          totalCorrectAnswers: user.level?.totalScore || 0,
          level: {
            currentLevel: user.monthlyProgress?.currentLevel || 0,
            levelName: user.monthlyProgress?.currentLevel === 10 ? 'Legend' : getLevelName(user.monthlyProgress?.currentLevel || 0),
            highScoreQuizzes: user.monthlyProgress?.highScoreWins || 0,
            quizzesPlayed: user.monthlyProgress?.totalQuizAttempts || 0,
            accuracy: user.monthlyProgress?.accuracy || 0,
            averageScore: user.monthlyProgress?.accuracy || 0,
            totalScore: user.level?.totalScore || 0
          }
        }));
      }
    }

    res.json({ 
      success: true, 
      data: { 
        month, 
        top,
        total: users.length,
        currentUser: currentUserData ? {
          userId: currentUserData._id,
          name: currentUserData.name,
          position: currentUserData.position,
          isCurrentUser: true,
          subscriptionName: getSubscriptionDisplayName(currentUserData.subscriptionStatus),
          totalCorrectAnswers: currentUserData.level?.totalScore || 0,
          level: {
            currentLevel: currentUserData.monthlyProgress?.currentLevel || 0,
            levelName: currentUserData.monthlyProgress?.currentLevel === 10 ? 'Legend' : getLevelName(currentUserData.monthlyProgress?.currentLevel || 0),
            highScoreQuizzes: currentUserData.monthlyProgress?.highScoreWins || 0,
            quizzesPlayed: currentUserData.monthlyProgress?.totalQuizAttempts || 0,
            accuracy: currentUserData.monthlyProgress?.accuracy || 0,
            averageScore: currentUserData.monthlyProgress?.accuracy || 0,
            totalScore: currentUserData.level?.totalScore || 0
          }
        } : null,
        surroundingUsers
      } 
    });
  } catch (error) {
    console.error('Error fetching top performers monthly:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch top performers monthly', 
      error: error.message 
    });
  }
};

// GET /api/public/landing-stats - Public platform statistics for landing page
exports.getLandingStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalQuizzes,
      totalQuizAttempts,
      totalCategories,
      totalSubcategories,
      totalQuestions,
      paidSubscriptions
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Quiz.countDocuments({ isActive: true }),
      QuizAttempt.countDocuments(),
      Category.countDocuments(),
      Subcategory.countDocuments(),
      Question.countDocuments(), // Remove isActive filter since Question model doesn't have it
      User.countDocuments({ 
        role: 'student',
        subscriptionStatus: { $nin: ['free'] } // Count users who don't have free subscription
      })
    ]);
    
    const stats = {
      activeStudents: totalUsers,
      quizCategories: totalCategories,
      subcategories: totalSubcategories,
      totalQuizzes: totalQuizzes,
      totalQuestions: totalQuestions,
      quizzesTaken: totalQuizAttempts,
      paidSubscriptions: paidSubscriptions, // Add count of users with paid subscriptions
      monthlyPrizePool: `₹${parseInt(process.env.MONTHLY_PRIZE_POOL) || 10000}`
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching landing stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch landing stats' });
  }
};

// GET /api/public/levels - Public levels data for landing page
exports.getPublicLevels = async (req, res) => {
  try {
    const levels = [
      { _id: '1', name: 'Starter', levelNumber: 0, description: 'Begin your learning journey', quizCount: 25 },
      { _id: '2', name: 'Rookie', levelNumber: 1, description: 'Build your foundation', quizCount: 30 },
      { _id: '3', name: 'Explorer', levelNumber: 2, description: 'Discover new knowledge', quizCount: 35 },
      { _id: '4', name: 'Thinker', levelNumber: 3, description: 'Develop critical thinking', quizCount: 40 },
      { _id: '5', name: 'Strategist', levelNumber: 4, description: 'Master strategic learning', quizCount: 45 },
      { _id: '6', name: 'Achiever', levelNumber: 5, description: 'Achieve excellence', quizCount: 50 },
      { _id: '7', name: 'Mastermind', levelNumber: 6, description: 'Become a master', quizCount: 55 },
      { _id: '8', name: 'Champion', levelNumber: 7, description: 'Champion level', quizCount: 60 },
      { _id: '9', name: 'Prodigy', levelNumber: 8, description: 'Prodigy level', quizCount: 65 },
      { _id: '10', name: 'Wizard', levelNumber: 9, description: 'Wizard level', quizCount: 70 },
      { _id: '11', name: 'Legend', levelNumber: 10, description: 'Legendary status', quizCount: 75 }
    ];

    res.json({ success: true, data: levels });
  } catch (error) {
    console.error('Error fetching public levels:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch public levels' });
  }
};

// GET /api/public/categories-enhanced - Enhanced categories with quiz counts
exports.getCategoriesEnhanced = async (req, res) => {
  try {
    const categories = await Category.find({});
    
    // Add mock quiz counts for now (can be enhanced later with real data)
    const enhancedCategories = categories.map(category => ({
      ...category.toObject(),
      quizCount: Math.floor(Math.random() * 50) + 20 // Random quiz count between 20-70
    }));

    res.json({ success: true, data: enhancedCategories });
  } catch (error) {
    console.error('Error fetching enhanced categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch enhanced categories' });
  }
};

// GET /api/public/landing-top-performers - Top performers for landing page
exports.getLandingTopPerformers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const month = dayjs().format('YYYY-MM'); // Current month
    
    // First, try to get users with monthly progress for current month
    let allUsers = await User.find({ 
      role: 'student',
      'monthlyProgress.month': month
    })
      .select('_id name monthlyProgress level profilePicture quizBestScores createdAt subscriptionStatus')
      .lean();

    // If we don't have enough users with current month data, get additional users with global level data
    if (allUsers.length < parseInt(limit)) {
      const additionalUsers = await User.find({ 
        role: 'student',
        $or: [
          { 'monthlyProgress.month': { $ne: month } },
          { monthlyProgress: { $exists: false } }
        ]
      })
        .select('_id name level profilePicture quizBestScores createdAt subscriptionStatus')
        .sort({ 'level.highScoreQuizzes': -1, 'level.averageScore': -1 })
        .limit(parseInt(limit) - allUsers.length)
        .lean();

      // Transform additional users to match monthly progress format
      const transformedAdditionalUsers = additionalUsers.map(user => ({
        _id: user._id,
        name: user.name,
        profilePicture: user.profilePicture,
        subscriptionStatus: user.subscriptionStatus,
        quizBestScores: user.quizBestScores || [],
        level: user.level || {
          totalScore: 0,
          quizzesPlayed: 0,
          averageScore: 0,
          currentLevel: 0,
          highScoreQuizzes: 0
        },
        monthlyProgress: {
          month: month,
          highScoreWins: user.level?.highScoreQuizzes || 0,
          totalQuizAttempts: user.level?.quizzesPlayed || 0,
          accuracy: user.level?.averageScore || 0,
          currentLevel: user.level?.currentLevel || 0,
          rewardEligible: false
        },
        createdAt: user.createdAt
      }));

      allUsers = [...allUsers, ...transformedAdditionalUsers];
    }

    // Helper function to calculate accuracy from quizBestScores array
    const calculateAccuracyFromBestScores = (quizBestScores) => {
      if (!quizBestScores || quizBestScores.length === 0) {
        return 0;
      }
      const totalPercentage = quizBestScores.reduce((sum, quiz) => {
        return sum + (quiz.bestScorePercentage || 0);
      }, 0);
      return Math.round(totalPercentage / quizBestScores.length);
    };

    // Ensure all users have complete data, set defaults if missing
    allUsers.forEach(user => {
      // Calculate accuracy from quizBestScores array
      const calculatedAccuracy = calculateAccuracyFromBestScores(user.quizBestScores);
      
      // Ensure monthlyProgress exists
      if (!user.monthlyProgress) {
        user.monthlyProgress = {
          month: month,
          highScoreWins: 0,
          totalQuizAttempts: 0,
          accuracy: calculatedAccuracy,
          currentLevel: 0,
          rewardEligible: false
        };
      } else {
        // Update accuracy with calculated value from quizBestScores
        user.monthlyProgress.accuracy = calculatedAccuracy;
      }
      
      // Ensure level data exists with all required fields
      if (!user.level) {
        user.level = {
          totalScore: 0,
          quizzesPlayed: 0,
          averageScore: 0,
          currentLevel: 0,
          highScoreQuizzes: 0
        };
      } else {
        // Ensure all level fields have default values if missing
        user.level.totalScore = user.level.totalScore || 0;
        user.level.quizzesPlayed = user.level.quizzesPlayed || 0;
        user.level.averageScore = user.level.averageScore || 0;
        user.level.currentLevel = user.level.currentLevel || 0;
        user.level.highScoreQuizzes = user.level.highScoreQuizzes || 0;
      }
    });

    // Sort by high score wins, accuracy, and total quizzes - same as Performance Analytics
    allUsers.sort((a, b) => {
      const aHighScore = a.monthlyProgress?.highScoreWins || 0;
      const bHighScore = b.monthlyProgress?.highScoreWins || 0;
      const aAccuracy = a.monthlyProgress?.accuracy || 0;
      const bAccuracy = b.monthlyProgress?.accuracy || 0;
      const aTotalQuizzes = a.monthlyProgress?.totalQuizAttempts || 0;
      const bTotalQuizzes = b.monthlyProgress?.totalQuizAttempts || 0;
      
      // First priority: High Score Wins (descending) - same as Performance Analytics
      if (aHighScore !== bHighScore) {
        return bHighScore - aHighScore;
      }
      
      // Second priority: Accuracy (descending) - same as Performance Analytics
      if (aAccuracy !== bAccuracy) {
        return bAccuracy - aAccuracy;
      }
      
      // Third priority: Total quizzes played (descending) - same as Performance Analytics
      return bTotalQuizzes - aTotalQuizzes;
    });

    // Get top performers and format for landing page with all required fields
    const topPerformers = allUsers.slice(0, parseInt(limit)).map((user, index) => ({
      _id: user._id,
      userId: user._id,
      name: user.name || 'Anonymous',
      profilePicture: user.profilePicture || null,
      subscriptionName: getSubscriptionDisplayName(user.subscriptionStatus),
      subscriptionStatus: user.subscriptionStatus || 'free',
      rank: index + 1,
      position: index + 1,
      userLevel: user.monthlyProgress?.currentLevel || 0,
      userLevelName: getLevelName(user.monthlyProgress?.currentLevel || 0),
      userLevelNo: user.monthlyProgress?.currentLevel || 0,
      totalQuizzes: user.monthlyProgress?.totalQuizAttempts || 0,
      highQuizzes: user.monthlyProgress?.highScoreWins || 0,
      accuracy: user.monthlyProgress?.accuracy || 0,
      // Add total score and correct answers count
      totalScore: user.level?.totalScore || 0,
      totalCorrectAnswers: user.level?.totalScore || 0, // totalScore represents total correct answers
      // Keep existing fields for backward compatibility
      level: user.monthlyProgress?.currentLevel || 0,
      score: user.monthlyProgress?.highScoreWins || 0,
      quizCount: user.monthlyProgress?.totalQuizAttempts || 0,
      // Add monthly and level details
      monthly: {
        month: month,
        highScoreWins: user.monthlyProgress?.highScoreWins || 0,
        totalQuizAttempts: user.monthlyProgress?.totalQuizAttempts || 0,
        accuracy: user.monthlyProgress?.accuracy || 0,
        currentLevel: user.monthlyProgress?.currentLevel || 0,
        rewardEligible: user.monthlyProgress?.rewardEligible || false
      }
    }));

    res.json({ success: true, data: topPerformers });
  } catch (error) {
    console.error('Error fetching landing top performers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch landing top performers' });
  }
};

// ===== ARTICLES - PUBLIC ROUTES =====

// GET /api/public/articles - Get published articles
exports.getPublishedArticles = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, featured, pinned } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { status: 'published' };

    // Apply filters
    if (category) query.category = category;
    if (featured === 'true') query.isFeatured = true;
    if (pinned === 'true') query.isPinned = true;

    const articles = await Article.find(query)
      .populate('author', 'name email')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Article.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        articles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching published articles:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch articles', 
      error: error.message 
    });
  }
};

// GET /api/public/articles/featured - Get featured articles
exports.getFeaturedArticles = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const articles = await Article.find({ 
      status: 'published', 
      isFeatured: true 
    })
      .populate('author', 'name email')
      .populate('category', 'name')
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: articles
    });
  } catch (error) {
    console.error('Error fetching featured articles:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch featured articles', 
      error: error.message 
    });
  }
};

// GET /api/public/articles/:slug - Get single article by slug
exports.getArticleBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const article = await Article.findOne({ 
      slug, 
      status: 'published' 
    })
      .populate('author', 'name email')
      .populate('category', 'name');

    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: 'Article not found' 
      });
    }

    // Increment view count
    await article.incrementViews();

    res.json({
      success: true,
      data: article
    });
  } catch (error) {
    console.error('Error fetching article by slug:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch article', 
      error: error.message 
    });
  }
};

// GET /api/public/articles/category/:categoryId - Get articles by category
exports.getArticlesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const articles = await Article.find({ 
      category: categoryId, 
      status: 'published' 
    })
      .populate('author', 'name email')
      .populate('category', 'name')
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Article.countDocuments({ 
      category: categoryId, 
      status: 'published' 
    });
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        articles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching articles by category:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch articles by category', 
      error: error.message 
    });
  }
};

// GET /api/public/articles/search - Search articles
exports.searchArticles = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!q || q.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required' 
      });
    }

    const articles = await Article.find({
      $text: { $search: q },
      status: 'published'
    })
      .populate('author', 'name email')
      .populate('category', 'name')
      .sort({ score: { $meta: 'textScore' }, publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Article.countDocuments({
      $text: { $search: q },
      status: 'published'
    });
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        articles,
        query: q,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Error searching articles:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search articles', 
      error: error.message 
    });
  }
};

// GET /api/public/articles/tag/:tag - Get articles by tag
exports.getArticlesByTag = async (req, res) => {
  try {
    const { tag } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const normalizedTag = String(tag).toLowerCase();

    const articles = await Article.find({
      status: 'published',
      tags: normalizedTag
    })
      .populate('author', 'name email')
      .populate('category', 'name')
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Article.countDocuments({ status: 'published', tags: normalizedTag });
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        tag: normalizedTag,
        articles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching articles by tag:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch articles by tag', 
      error: error.message 
    });
  }
};

// POST /api/public/articles/:id/view - Increment article views
exports.incrementArticleViews = async (req, res) => {
  try {
    const { id } = req.params;

    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: 'Article not found' 
      });
    }

    await article.incrementViews();

    res.json({
      success: true,
      message: 'View count updated',
      views: article.views
    });
  } catch (error) {
    console.error('Error incrementing article views:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update view count', 
      error: error.message 
    });
  }
};

// POST /api/public/articles/:id/like - Increment article likes
exports.incrementArticleLikes = async (req, res) => {
  try {
    const { id } = req.params;

    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: 'Article not found' 
      });
    }

    await article.incrementLikes();

    res.json({
      success: true,
      message: 'Like count updated',
      likes: article.likes
    });
  } catch (error) {
    console.error('Error incrementing article likes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update like count', 
      error: error.message 
    });
  }
};
