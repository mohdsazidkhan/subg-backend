const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// POST /api/contacts - Save contact
router.post('/', contactController.createContact);

module.exports = router; 