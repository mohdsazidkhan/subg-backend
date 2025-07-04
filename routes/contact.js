const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// POST /api/contacts - Save contact
router.post('/', contactController.createContact);

// GET /api/contacts - Get all contacts
router.get('/', contactController.getContacts);

module.exports = router; 