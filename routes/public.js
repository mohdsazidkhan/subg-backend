const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const { protect } = require('../middleware/auth');

// GET /api/public/categories - Public categories API
router.get('/categories', publicController.getCategories);

// GET /api/public/top-performers - Public top performers API for students (requires auth)
router.get('/top-performers', protect, publicController.getTopPerformers);

// GET /api/public/monthly-leaderboard - Monthly top eligible users (no auth required)
router.get('/monthly-leaderboard', publicController.getMonthlyLeaderboard);

// GET /api/public/top-performers-monthly - Top 10 performers for current month (no auth required)
router.get('/top-performers-monthly', publicController.getTopPerformersMonthly);

// NEW: Landing page specific APIs (no auth required)
// GET /api/public/landing-stats - Platform statistics for landing page
router.get('/landing-stats', publicController.getLandingStats);

// GET /api/public/levels - Levels data for landing page
router.get('/levels', publicController.getPublicLevels);

// GET /api/public/categories-enhanced - Enhanced categories with quiz counts
router.get('/categories-enhanced', publicController.getCategoriesEnhanced);

// GET /api/public/landing-top-performers - Top performers for landing page
router.get('/landing-top-performers', publicController.getLandingTopPerformers);

module.exports = router;
