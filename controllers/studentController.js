// controllers/studentController.js
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const Quiz = require('../models/Quiz');

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // from protect middleware JWT verify
    const user = await User.findById(userId).select('-password').populate('currentSubscription');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get level information
    const levelInfo = user.getLevelInfo();

    res.json({
      ...user.toObject(),
      levelInfo: levelInfo
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Only include students in leaderboard
    const users = await User.find({
      role: 'student', // Always filter for students only
      'level.averageScore': { $exists: true, $ne: null },
      'level.highScoreQuizzes': { $exists: true, $ne: null }
    })
      .select('name level badges subscriptionStatus')
      .sort({ 
        'level.averageScore': -1, 
        'level.highScoreQuizzes': -1, 
        'level.currentLevel': -1 
      })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments({
      role: 'student', // Always filter for students only
      'level.averageScore': { $exists: true, $ne: null },
      'level.highScoreQuizzes': { $exists: true, $ne: null }
    });

    const leaderboard = users.map((user, index) => ({
      rank: skip + index + 1,
      studentId: user._id,
      studentName: user.name || 'Anonymous',
      level: {
        currentLevel: user.level?.currentLevel || 1,
        levelName: user.level?.levelName || 'Rookie',
        highScoreQuizzes: user.level?.highScoreQuizzes || 0,
        averageScore: user.level?.averageScore || 0
      },
      badges: user.badges || [],
      subscriptionStatus: user.subscriptionStatus || 'free'
    }));

    res.json({
      success: true,
      leaderboard,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNextPage: skip + users.length < total,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error('Leaderboard fetch error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('subscriptionStatus subscriptionExpiry currentSubscription badges level').populate('currentSubscription');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get level information
    const levelInfo = user.getLevelInfo();

    res.json({ 
      subscriptionStatus: user.subscriptionStatus, 
      subscriptionExpiry: user.subscriptionExpiry,
      currentSubscription: user.currentSubscription,
      badges: user.badges,
      level: levelInfo
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addBadge = async (req, res) => {
  try {
    const userId = req.user.id;
    const { badge } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.badges.push(badge);
    await user.save();

    res.json({ message: 'Badge added', badges: user.badges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.removeBadge = async (req, res) => {
  try {
    const userId = req.user.id;
    const { badge } = req.body;

    if (!badge) return res.status(400).json({ error: 'Badge is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.badges = user.badges.filter(b => b !== badge);
    await user.save();

    res.json({ message: 'Badge removed successfully', badges: user.badges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get quiz-specific leaderboard
exports.getQuizLeaderboard = async (req, res) => {
  try {
    const { quizId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Verify quiz exists
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    // Get quiz attempts for this specific quiz, sorted by score percentage (descending)
    const attempts = await QuizAttempt.find({ quiz: quizId })
      .populate('user', 'name')
      .sort({ scorePercentage: -1, attemptedAt: 1 }) // Higher score first, then earlier attempt
      .skip(skip)
      .limit(limit);

    const total = await QuizAttempt.countDocuments({ quiz: quizId });

    // Transform data to match frontend expectations
    const leaderboard = attempts.map((attempt, index) => ({
      rank: skip + index + 1,
      studentId: attempt.user._id,
      studentName: attempt.user.name || 'Anonymous',
      score: attempt.scorePercentage, // Use scorePercentage as the main score
      attemptedAt: attempt.attemptedAt,
      totalQuestions: attempt.score + (attempt.answers?.filter(a => a.answer === 'SKIP').length || 0),
      correctAnswers: attempt.score,
      isBestScore: attempt.isBestScore
    }));

    res.json({
      success: true,
      leaderboard,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalAttempts: total,
        hasNextPage: skip + attempts.length < total,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error('Quiz leaderboard fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
