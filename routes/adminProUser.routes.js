const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/adminProUserContentController');

// User Questions admin review
router.get('/userQuestions', protect, adminOnly, ctrl.listUserQuestions);
router.patch('/userQuestions/:id/status', protect, adminOnly, ctrl.updateUserQuestionStatus);

// Withdraw requests admin review
router.get('/withdrawRequests', protect, adminOnly, ctrl.listWithdrawRequests);
router.patch('/withdrawRequests/:id/status', protect, adminOnly, ctrl.updateWithdrawStatus);

module.exports = router;


