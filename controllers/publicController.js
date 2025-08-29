const Category = require('../models/Category');
const User = require('../models/User');
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
    
    // Get all users with monthly progress for current month
    const allUsers = await User.find({ 
      role: 'student',
      'monthlyProgress.month': month
    })
      .select('_id name monthlyProgress createdAt')
      .lean();

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
      
      // Third priority: Total quiz attempts (ascending - fewer is better)
      const aTotalQuizzes = a.monthlyProgress?.totalQuizAttempts || 0;
      const bTotalQuizzes = b.monthlyProgress?.totalQuizAttempts || 0;
      return aTotalQuizzes - bTotalQuizzes;
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
      'monthlyProgress.month': month,
      'monthlyProgress.currentLevel': 10,
      'monthlyProgress.accuracy': { $gte: 75 },
      'monthlyProgress.rewardEligible': true
    })
    .select('name monthlyProgress subscriptionStatus')
    .lean();

    // Sort: wins desc, then accuracy desc
    users.sort((a, b) => {
      const aw = a.monthlyProgress?.highScoreWins || 0;
      const bw = b.monthlyProgress?.highScoreWins || 0;
      if (aw !== bw) return bw - aw;
      const aa = a.monthlyProgress?.accuracy || 0;
      const ba = b.monthlyProgress?.accuracy || 0;
      return ba - aa;
    });

    const top = users.slice(0, limit).map((u, idx) => ({
      userId: u._id,
      name: u.name,
      rank: idx + 1,
      month,
      monthly: {
        highScoreWins: u.monthlyProgress?.highScoreWins || 0,
        totalQuizAttempts: u.monthlyProgress?.totalQuizAttempts || 0,
        accuracy: u.monthlyProgress?.accuracy || 0,
        currentLevel: u.monthlyProgress?.currentLevel || 0,
        rewardEligible: !!u.monthlyProgress?.rewardEligible
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

// GET /api/public/top-performers-monthly - Top 10 performers for current month based on performance
exports.getTopPerformersMonthly = async (req, res) => {
  try {
    const month = dayjs().format('YYYY-MM');
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const currentUserId = req.query.userId; // Get current user ID from query parameter

    // Get all users with monthly progress for current month
    const users = await User.find({ 
      role: 'student',
      'monthlyProgress.month': month
    })
    .select('_id name monthlyProgress profilePicture')
    .lean();

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
    });

    // Sort by performance: first by high score wins, then by accuracy, then by level
    users.sort((a, b) => {
      const aWins = a.monthlyProgress?.highScoreWins || 0;
      const bWins = b.monthlyProgress?.highScoreWins || 0;
      
      if (aWins !== bWins) return bWins - aWins;
      
      const aAccuracy = a.monthlyProgress?.accuracy || 0;
      const bAccuracy = b.monthlyProgress?.accuracy || 0;
      
      if (aAccuracy !== bAccuracy) return bAccuracy - aAccuracy;
      
      const aLevel = a.monthlyProgress?.currentLevel || 0;
      const bLevel = b.monthlyProgress?.currentLevel || 0;
      
      return bLevel - aLevel;
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
          level: {
            currentLevel: user.monthlyProgress?.currentLevel || 0,
            levelName: user.monthlyProgress?.currentLevel === 10 ? 'Legend' : getLevelName(user.monthlyProgress?.currentLevel || 0),
            highScoreQuizzes: user.monthlyProgress?.highScoreWins || 0,
            quizzesPlayed: user.monthlyProgress?.totalQuizAttempts || 0,
            accuracy: user.monthlyProgress?.accuracy || 0,
            averageScore: user.monthlyProgress?.accuracy || 0
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
          level: {
            currentLevel: currentUserData.monthlyProgress?.currentLevel || 0,
            levelName: currentUserData.monthlyProgress?.currentLevel === 10 ? 'Legend' : getLevelName(currentUserData.monthlyProgress?.currentLevel || 0),
            highScoreQuizzes: currentUserData.monthlyProgress?.highScoreWins || 0,
            quizzesPlayed: currentUserData.monthlyProgress?.totalQuizAttempts || 0,
            accuracy: currentUserData.monthlyProgress?.accuracy || 0,
            averageScore: currentUserData.monthlyProgress?.accuracy || 0
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
