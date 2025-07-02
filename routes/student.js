// routes/student.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const studentController = require('../controllers/studentController');
const quizController = require('../controllers/quizController');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Quiz = require('../models/Quiz');

// Test route to verify student routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Student routes are working!' });
});

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
// UNUSED ENDPOINTS - commented out as not used in frontend
// router.get('/wallet', protect, studentController.getWallet);
// router.post('/badge/add', protect, studentController.addBadge);
// router.post('/badge/remove', protect, studentController.removeBadge);

// GET all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// GET all subcategories
router.get('/subcategories', async (req, res) => {
  try {
    const { category } = req.query;
    let query = {};
    
    // If category parameter is provided, filter by category
    if (category) {
      query.category = category;
    }
    
    const subs = await Subcategory.find(query).populate('category', 'name');
    res.json(subs);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subcategories' });
  }
});

// GET all quizzes (keeping for backward compatibility)
router.get('/quizzes', async (req, res) => {
  try {
    const quizzes = await Quiz.find()
      .populate('category', 'name')
      .populate('subcategory', 'name');
    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quizzes' });
  }
});

module.exports = router;
