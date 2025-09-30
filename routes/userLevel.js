const express = require('express');
const router = express.Router();
const userLevelController = require('../controllers/userLevelController');
const { protect } = require('../middleware/auth');

// Get level-based quizzes (protected)
router.get('/quizzes', protect, userLevelController.getLevelQuizzes);

// Get all levels with quiz counts (public)
router.get('/all-with-quiz-count', userLevelController.getAllLevelsWithQuizCount);

// Get user's quiz history with level progression (protected)
router.get('/history', protect, userLevelController.getUserQuizHistory);

// Get monthly reward information (protected)
router.get('/monthly-rewards', protect, userLevelController.getMonthlyRewardInfo);

module.exports = router; 