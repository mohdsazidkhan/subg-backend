const express = require('express');
const router = express.Router();
const { register, login, forgotPassword, resetPassword, googleAuth, updateProfile } = require('../controllers/authController');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');
const { protect } = require('../middleware/auth');

router.post('/register', validateUserRegistration, register);
router.post('/login', validateUserLogin, login);
router.post('/google', googleAuth);
router.put('/update-profile', protect, updateProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
