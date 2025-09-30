const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/proUserWalletController');

router.get('/userWallet/:userId', protect, ctrl.getWallet);

module.exports = router;


