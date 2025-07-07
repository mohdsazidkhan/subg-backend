const express = require('express');
const router = express.Router();
const userLevelController = require('../controllers/userLevelController');
const { protect } = require('../middleware/auth');

// Get home page level quizzes (public)
router.get('/home-quizzes', userLevelController.getHomeQuizzes);

// Get level-based quizzes (protected)
router.get('/quizzes', protect, userLevelController.getLevelQuizzes);

// Get user's current level (protected)
router.get('/user-level', protect, userLevelController.getUserLevel);

// Get all levels information (public)
router.get('/all', userLevelController.getAllLevels);

// Get all levels with quiz counts (public)
router.get('/all-with-quiz-count', userLevelController.getAllLevelsWithQuizCount);

// Get leaderboard by level (public)
router.get('/leaderboard/:level', userLevelController.getLevelLeaderboard);

// Get user's quiz history with level progression (protected)
router.get('/history', protect, userLevelController.getUserQuizHistory);

// Get level statistics (public)
router.get('/stats', userLevelController.getLevelStats);

module.exports = router; 