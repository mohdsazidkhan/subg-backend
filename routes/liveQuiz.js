const express = require('express');
const router = express.Router();
const {
  getAllLiveQuizzes,
  getLiveQuizzes,
  joinLiveQuiz,
  getPlayedQuizzesByUser
} = require('../controllers/liveQuizController');

const { protect } = require('../middleware/auth');

router.get('/all', getAllLiveQuizzes);
router.get('/active', getLiveQuizzes);
router.post('/join', protect, joinLiveQuiz)
router.get('/played/:userId', getPlayedQuizzesByUser);

module.exports = router;
