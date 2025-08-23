const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const { protect } = require('../middleware/auth');

// GET /api/public/categories - Public categories API
router.get('/categories', publicController.getCategories);

// GET /api/public/top-performers - Public top performers API for students (requires auth)
router.get('/top-performers', protect, publicController.getTopPerformers);

module.exports = router;
