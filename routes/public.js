const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const { protect } = require('../middleware/auth');

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Backend server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

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

// ARTICLES - Public routes
// GET /api/public/articles - Get published articles
router.get('/articles', publicController.getPublishedArticles);

// GET /api/public/articles/featured - Get featured articles
router.get('/articles/featured', publicController.getFeaturedArticles);

// GET /api/public/articles/:slug - Get single article by slug
router.get('/articles/:slug', publicController.getArticleBySlug);

// GET /api/public/articles/category/:categoryId - Get articles by category
router.get('/articles/category/:categoryId', publicController.getArticlesByCategory);

// GET /api/public/articles/search - Search articles
router.get('/articles/search', publicController.searchArticles);

// GET /api/public/articles/tag/:tag - Get articles by tag
router.get('/articles/tag/:tag', publicController.getArticlesByTag);

// POST /api/public/articles/:id/view - Increment article views
router.post('/articles/:id/view', publicController.incrementArticleViews);

// POST /api/public/articles/:id/like - Increment article likes
router.post('/articles/:id/like', publicController.incrementArticleLikes);

module.exports = router;
