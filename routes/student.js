// routes/student.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const studentController = require('../controllers/studentController');
const quizController = require('../controllers/quizController');
const leaderboardController = require('../controllers/leaderboardController');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Quiz = require('../models/Quiz');

router.get('/:quizid/leaderboard/', protect, leaderboardController.getLeaderboard);
router.post('/quizzes/:quizid/attempt', protect, quizController.attemptQuiz);
router.get('/quizzes/:quizid', protect, quizController.getQuizWithQuestions);
router.get('/profile', protect, studentController.getProfile);
router.get('/wallet', protect, studentController.getWallet);
router.post('/wallet/add-coins', protect, studentController.addCoins);
router.post('/badge/add', protect, studentController.addBadge);
router.post('/badge/remove', protect, studentController.removeBadge);

// GET all categories
router.get('/categories', async (req, res) => {
  const categories = await Category.find();
  res.json(categories);
});
// GET all subcategories
router.get('/subcategories', async (req, res) => {
  const subs = await Subcategory.find().populate('category', 'name');
  res.json(subs);
});

// GET all quizzes
router.get('/quizzes', async (req, res) => {
  const quizzes = await Quiz.find()
    .populate('category', 'name')
    .populate('subcategory', 'name');
  res.json(quizzes);
});


module.exports = router;
