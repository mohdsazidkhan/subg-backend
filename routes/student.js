// routes/student.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const studentController = require('../controllers/studentController');
const quizController = require('../controllers/quizController');

// Test route to verify student routes are working
router.get('/test', studentController.test);

router.post('/quizzes/:quizid/attempt', protect, quizController.attemptQuiz);

// New level-based quiz routes
router.get('/quizzes/level-based', protect, quizController.getQuizzesByLevel);
router.get('/quizzes/recommended', protect, quizController.getRecommendedQuizzes);
router.get('/quizzes/difficulty-distribution', protect, quizController.getQuizDifficultyDistribution);
router.get('/quizzes/home-level', protect, quizController.getHomePageLevelQuizzes);
router.get('/homepage-data', protect, quizController.getHomePageData);

router.get('/quizzes/:quizid', protect, quizController.getQuizWithQuestions);

// Add quiz result endpoint
router.get('/quizzes/:quizid/result', protect, quizController.getQuizResult);

router.get('/profile', protect, studentController.getProfile);
router.get('/leaderboard', protect, studentController.getLeaderboard);
router.get('/leaderboard/quiz/:quizId', protect, studentController.getQuizLeaderboard);

// GET all categories
router.get('/categories', studentController.getCategories);

// GET all subcategories
router.get('/subcategories', studentController.getSubcategories);

// GET all quizzes (keeping for backward compatibility)
router.get('/quizzes', studentController.getAllQuizzes);

module.exports = router;
