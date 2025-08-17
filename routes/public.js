const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// GET /api/public/categories - Public categories API
router.get('/categories', publicController.getCategories);

module.exports = router;
