const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const monthlyWinnersCtrl = require('../controllers/monthlyWinnersController');

// Public routes (no authentication required)
router.get('/recent', monthlyWinnersCtrl.getRecentMonthlyWinners);
router.get('/stats', monthlyWinnersCtrl.getMonthlyWinnersStats);
router.get('/current', monthlyWinnersCtrl.getCurrentMonthWinners);
router.get('/month/:monthYear', monthlyWinnersCtrl.getMonthlyWinners);

// Protected routes (authentication required)
router.get('/user/:userId/history', protect, monthlyWinnersCtrl.getUserWinningHistory);

module.exports = router;
