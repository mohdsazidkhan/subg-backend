const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/proWithdrawController');

router.post('/withdrawRequests/create', protect, ctrl.createWithdrawRequest);

module.exports = router;


