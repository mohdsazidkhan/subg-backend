// controllers/leaderboardController.js
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');

exports.getLeaderboard = async (req, res) => {
  try {
    const quizId = req.params.quizid;  // Make sure your route uses ':quizid'

    // Find top 10 attempts for this quiz, sorted by highest score then earliest attempt
    const topAttempts = await QuizAttempt.find({ quiz: quizId })
      .sort({ score: -1, attemptedAt: 1 })
      .limit(10)
      .populate('student', '_id name')
      .lean();

    // Format leaderboard data
    const leaderboard = topAttempts.map((attempt, index) => ({
      rank: index + 1,
      studentName: attempt.student?.name || 'Anonymous',
      studentId: attempt.student?._id?.toString() || '',
      score: attempt.score,
      attemptedAt: attempt.attemptedAt,
    }));

    return res.json({ leaderboard });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};
