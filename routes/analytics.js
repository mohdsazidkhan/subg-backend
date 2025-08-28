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

// Monthly progress analytics
router.get('/monthly-progress', protect, admin, analyticsController.getMonthlyProgressAnalytics);

// Individual user performance analytics
router.get('/users/:userId/performance', protect, admin, analyticsController.getUserPerformanceAnalytics);

module.exports = router; 