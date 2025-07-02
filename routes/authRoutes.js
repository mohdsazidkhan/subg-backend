const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');

router.post('/register', validateUserRegistration, register);
router.post('/login', validateUserLogin, login);

module.exports = router;
