const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

// GET /api/public/categories - Public categories API
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find({});
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: err.message });
  }
});

module.exports = router;
