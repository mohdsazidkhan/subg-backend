const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// GET /api/public/categories - Public categories API
router.get('/categories', publicController.getCategories);

// GET /api/public/top-performers - Public top performers API for students
router.get('/top-performers', publicController.getTopPerformers);

module.exports = router;
