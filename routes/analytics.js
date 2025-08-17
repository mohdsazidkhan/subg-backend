const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect, admin } = require('../middleware/auth');

// Dashboard overview analytics
router.get('/dashboard', protect, admin, analyticsController.getDashboardOverview);

// User analytics
router.get('/users', protect, admin, analyticsController.getUserAnalytics);

// Quiz analytics
router.get('/quizzes', protect, admin, analyticsController.getQuizAnalytics);

// Financial analytics
router.get('/financial', protect, admin, analyticsController.getFinancialAnalytics);

// Performance analytics
router.get('/performance', protect, admin, analyticsController.getPerformanceAnalytics);

module.exports = router; 