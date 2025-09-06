const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const Quiz = require('../models/Quiz');

// Get user's current level information
exports.getUserLevel = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const levelInfo = user.getLevelInfo();

    res.status(200).json({
      success: true,
      data: {
        level: levelInfo,
        user: {
          _id: user._id,
          name: user.name,
          badges: user.badges,
          subscriptionStatus: user.subscriptionStatus
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user level:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user level',
      error: error.message
    });
  }
};

// Get all level information
exports.getAllLevels = async (req, res) => {
  try {
    const levels = [];
    const config = User.LEVEL_CONFIG;

    for (let i = 0; i <= 10; i++) {
      levels.push({
        level: i,
        name: config[i].name,
        description: config[i].description,
        quizzesRequired: config[i].quizzesRequired,
        emoji: getLevelEmoji(i)
      });
    }

    res.status(200).json({
      success: true,
      data: levels
    });

  } catch (error) {
    console.error('Error fetching all levels:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch levels',
      error: error.message
    });
  }
};

// Get leaderboard by level
exports.getLevelLeaderboard = async (req, res) => {
  try {
    const { level } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const levelNumber = parseInt(level);
    if (levelNumber < 0 || levelNumber > 10) {
      return res.status(400).json({ success: false, message: 'Invalid level' });
    }

    const config = User.LEVEL_CONFIG;
    const minQuizzes = config[levelNumber].quizzesRequired;
    const maxQuizzes = levelNumber < 10 ? config[levelNumber + 1].quizzesRequired - 1 : Number.MAX_SAFE_INTEGER;

    const skip = (page - 1) * limit;

    const users = await User.find({
      role: 'student', // Only include students
      'level.currentLevel': levelNumber,
      'level.highScoreQuizzes': { $gte: minQuizzes, $lte: maxQuizzes }
    })
    .select('name level badges')
    .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
    .skip(skip)
    .limit(limit);

    const total = await User.countDocuments({
      role: 'student', // Only include students
      'level.currentLevel': levelNumber,
      'level.highScoreQuizzes': { $gte: minQuizzes, $lte: maxQuizzes }
    });

    const leaderboard = users.map((user, index) => ({
      rank: skip + index + 1,
      user: {
        _id: user._id,
        name: user.name,
        badges: user.badges
      },
      level: {
        currentLevel: user.level.currentLevel,
        levelName: user.level.levelName,
        quizzesPlayed: user.level.quizzesPlayed,
        highScoreQuizzes: user.level.highScoreQuizzes,
        averageScore: user.level.averageScore,
        totalScore: user.level.totalScore
      }
    }));

    res.status(200).json({
      success: true,
      data: {
        level: {
          number: levelNumber,
          name: config[levelNumber].name,
          description: config[levelNumber].description,
          emoji: getLevelEmoji(levelNumber)
        },
        leaderboard,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNextPage: skip + users.length < total,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching level leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
      error: error.message
    });
  }
};

// Get user's quiz history with level progression
exports.getUserQuizHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const skip = (page - 1) * limit;

    const quizAttempts = await QuizAttempt.find({ user: userId })
      .populate({
        path: 'quiz',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subcategory', select: 'name' }
        ]
      })
      .sort({ attemptedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await QuizAttempt.countDocuments({ user: userId });

    // Add level information to each attempt
    const attemptsWithLevel = quizAttempts.map(attempt => {
      return {
        ...attempt.toObject(),
        quizTitle: attempt.quiz?.title || 'Unknown Quiz',
        categoryName: attempt.quiz?.category?.name || 'Unknown Category',
        subcategoryName: attempt.quiz?.subcategory?.name || 'Unknown Subcategory'
      };
    });

    res.status(200).json({
      success: true,
      data: {
        attempts: attemptsWithLevel,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalAttempts: total,
          hasNextPage: skip + quizAttempts.length < total,
          hasPrevPage: page > 1
        },
        currentLevel: user.getLevelInfo()
      }
    });

  } catch (error) {
    console.error('Error fetching quiz history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quiz history',
      error: error.message
    });
  }
};

// Get level statistics
exports.getLevelStats = async (req, res) => {
  try {
    const stats = {};
    const config = User.LEVEL_CONFIG;

    for (let i = 0; i <= 10; i++) {
      const minQuizzes = config[i].quizzesRequired;
      const maxQuizzes = i < 10 ? config[i + 1].quizzesRequired - 1 : Number.MAX_SAFE_INTEGER;

      const userCount = await User.countDocuments({
        role: 'student', // Only include students
        'level.currentLevel': i,
        'level.highScoreQuizzes': { $gte: minQuizzes, $lte: maxQuizzes }
      });

      const avgScore = await User.aggregate([
        {
          $match: {
            role: 'student', // Only include students
            'level.currentLevel': i,
            'level.highScoreQuizzes': { $gte: minQuizzes, $lte: maxQuizzes }
          }
        },
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$level.averageScore' },
            totalUsers: { $sum: 1 }
          }
        }
      ]);

      stats[i] = {
        level: i,
        name: config[i].name,
        emoji: getLevelEmoji(i),
        userCount,
        averageScore: avgScore.length > 0 ? Math.round(avgScore[0].averageScore) : 0,
        quizzesRequired: config[i].quizzesRequired
      };
    }

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching level stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch level stats',
      error: error.message
    });
  }
};

// Get home page level quizzes
exports.getHomeQuizzes = async (req, res) => {
  try {
    const { limit = 6, userLevel } = req.query;
    const token = req.headers.authorization?.split(" ")[1];
    
    let currentUser = null;
    let userLevelInfo = null;

    // If user is authenticated, get their level info
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUser = await User.findById(decoded.id);
        if (currentUser) {
          // Ensure level progress is calculated correctly
          currentUser.updateLevel();
          await currentUser.save();
          
          userLevelInfo = currentUser.getLevelInfo();
        }
      } catch (error) {
        // Token is invalid, continue as guest user
        console.log('Invalid token, serving as guest user');
      }
    }

    // Get quizzes based on user level or default to level 0
    const targetLevel = userLevelInfo?.currentLevel?.number || 0;
    
    // Find quizzes suitable for the user's level
    const quizzes = await Quiz.find({
      requiredLevel: { $lte: targetLevel + 1 }, // Show quizzes up to one level above
      isActive: true
    })
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    // Add attempt status for authenticated users
    let quizzesWithStatus = quizzes;
    if (currentUser) {
      quizzesWithStatus = quizzes.map(quiz => {
        const attemptStatus = currentUser.canAttemptQuiz(quiz._id);
        return {
          ...quiz.toObject(),
          attemptStatus,
          isRecommended: quiz.requiredLevel === targetLevel
        };
      });
    } else {
      // For guest users, mark all quizzes as can attempt
      quizzesWithStatus = quizzes.map(quiz => ({
        ...quiz.toObject(),
        attemptStatus: {
          canAttempt: true,
          attemptsLeft: 1,
          attemptNumber: 1,
          bestScore: null
        },
        isRecommended: quiz.requiredLevel === targetLevel
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        quizzes: quizzesWithStatus,
        userLevel: userLevelInfo?.currentLevel ? {
          ...userLevelInfo.currentLevel,
          progress: userLevelInfo.progress.progressPercentage,
          highScoreQuizzes: userLevelInfo.progress.highScoreQuizzes,
          totalQuizzesPlayed: userLevelInfo.progress.quizzesPlayed
        } : {
          number: 0,
          name: 'Starter',
          description: 'Just registered - Start your journey!',
          progress: 0,
          highScoreQuizzes: 0,
          totalQuizzesPlayed: 0
        },
        totalQuizzes: quizzesWithStatus.length
      }
    });

  } catch (error) {
    console.error('Error fetching home quizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home quizzes',
      error: error.message
    });
  }
};

// Get level-based quizzes for the level-quizzes page
exports.getLevelQuizzes = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: No user info found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure level progress is calculated correctly
    user.updateLevel();
    await user.save();

    const currentLevel = user.level.currentLevel;
    const nextLevel = currentLevel + 1;
    const { category, subcategory, difficulty, level, attempted, search, limit = 20, page = 1 } = req.query;

    // Check user's level access permissions for next level
    const levelAccess = user.canAccessLevel(nextLevel);
    if (!levelAccess.canAccess) {
      return res.status(403).json({ 
        message: `You need a ${levelAccess.requiredPlan} subscription to access level ${nextLevel} quizzes`,
        requiredPlan: levelAccess.requiredPlan,
        accessibleLevels: levelAccess.accessibleLevels
      });
    }

    // Build query for next level quizzes
    let query = {
      isActive: true,
      requiredLevel: nextLevel // Always show quizzes from next level
    };

    // Add category filter if provided
    if (category) {
      query.category = category;
    }

    // Add subcategory filter if provided
    if (subcategory) {
      query.subcategory = subcategory;
    }

    // Add difficulty filter if provided
    if (difficulty) {
      query.difficulty = difficulty;
    }

    // Add search filter if provided
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const searchQuery = {
        $or: [
          { title: searchRegex },
          { description: searchRegex }
        ]
      };
      
      // If we already have an $and query, add search to it
      if (query.$and) {
        query.$and.push(searchQuery);
      } else if (query.$or) {
        // If we have an $or query, convert to $and to combine with search
        const existingOr = query.$or;
        query.$and = [existingOr, searchQuery];
        delete query.$or;
      } else {
        // No existing complex query, just add search
        query.$and = [searchQuery];
      }
    }

    // Get attempted quizzes for the user
    const attemptedQuizzes = await QuizAttempt.find({ user: userId })
      .distinct('quiz');

    // Always exclude attempted quizzes by default, unless specifically requested
    if (attempted === 'attempted') {
      query._id = { $in: attemptedQuizzes };
    } else {
      // Default behavior: exclude attempted quizzes
      query._id = { $nin: attemptedQuizzes };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let quizzes = await Quiz.find(query)
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ 
        // Sort by creation date (newest first)
        createdAt: -1
      })
      .skip(skip)
      .limit(parseInt(limit));

    // If search is provided, also filter by category and subcategory names
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      quizzes = quizzes.filter(quiz => {
        const categoryName = quiz.category?.name?.toLowerCase() || '';
        const subcategoryName = quiz.subcategory?.name?.toLowerCase() || '';
        return categoryName.includes(searchTerm) || subcategoryName.includes(searchTerm);
      });
    }

    // Get total count - if search is active, we need to count after filtering
    let total;
    if (search && search.trim()) {
      // For search, we need to get all results and count after filtering
      const allQuizzes = await Quiz.find(query)
        .populate('category', 'name')
        .populate('subcategory', 'name');
      
      const searchTerm = search.trim().toLowerCase();
      const filteredQuizzes = allQuizzes.filter(quiz => {
        const categoryName = quiz.category?.name?.toLowerCase() || '';
        const subcategoryName = quiz.subcategory?.name?.toLowerCase() || '';
        return categoryName.includes(searchTerm) || subcategoryName.includes(searchTerm);
      });
      
      total = filteredQuizzes.length;
    } else {
      total = await Quiz.countDocuments(query);
    }

    const quizzesWithStatus = quizzes.map(quiz => {
      const attemptStatus = user.canAttemptQuiz(quiz._id);
      return {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        category: quiz.category,
        subcategory: quiz.subcategory,
        difficulty: quiz.difficulty,
        requiredLevel: quiz.requiredLevel,
        timeLimit: quiz.timeLimit,
        totalMarks: quiz.totalMarks,
        isRecommended: level && level !== '' 
          ? quiz.requiredLevel === parseInt(level) 
          : quiz.requiredLevel === userLevel,
        levelMatch: {
          exact: quiz.requiredLevel === userLevel,
          withinRange: quiz.requiredLevel >= Math.max(0, userLevel - 1) && 
                      quiz.requiredLevel <= Math.min(10, userLevel + 2)
        },
        attemptStatus: {
          hasAttempted: attemptStatus.canAttempt === false,
          canAttempt: attemptStatus.canAttempt,
          bestScore: attemptStatus.bestScore,
          isHighScore: attemptStatus.isHighScore
        }
      };
    });

    res.json({
      success: true,
      data: quizzesWithStatus,
      userLevel: {
        currentLevel: currentLevel,
        nextLevel: nextLevel,
        levelName: user.level.levelName,
        progress: user.level.levelProgress,
        highScoreQuizzes: user.level.highScoreQuizzes,
        totalQuizzesPlayed: user.level.quizzesPlayed
      },
      levelAccess: {
        accessibleLevels: levelAccess.accessibleLevels,
        userPlan: levelAccess.userPlan
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalQuizzes: total,
        hasNextPage: skip + quizzesWithStatus.length < total,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Error fetching level quizzes:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch level quizzes',
      error: error.message 
    });
  }
};

// Get all levels with quiz counts
exports.getAllLevelsWithQuizCount = async (req, res) => {
  try {
    const levels = [];
    const config = User.LEVEL_CONFIG;
    for (let i = 0; i <= 10; i++) {
      const quizCount = await Quiz.countDocuments({ requiredLevel: i, isActive: true });
      levels.push({
        level: i,
        name: config[i].name,
        description: config[i].description,
        quizzesRequired: config[i].quizzesRequired,
        quizCount,
        emoji: getLevelEmoji(i)
      });
    }
    res.status(200).json({
      success: true,
      data: levels
    });
  } catch (error) {
    console.error('Error fetching all levels with quiz count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch levels with quiz count',
      error: error.message
    });
  }
};

// Helper functions
function getLevelEmoji(level) {
  const emojis = {
    0: '0️⃣',
    1: '1️⃣',
    2: '2️⃣', 
    3: '3️⃣',
    4: '4️⃣',
    5: '5️⃣',
    6: '6️⃣',
    7: '7️⃣',
    8: '8️⃣',
    9: '9️⃣',
    10: '🔟'
  };
  return emojis[level] || '🎯';
}

function calculateLevelAtTime(highScoreQuizzesPlayed) {
  const config = User.LEVEL_CONFIG;
  let level = 0;
  let name = 'Starter';

  for (let i = 10; i >= 0; i--) {
    if (highScoreQuizzesPlayed >= config[i].quizzesRequired) {
      level = i;
      name = config[i].name;
      break;
    }
  }

  return { level, name };
} 