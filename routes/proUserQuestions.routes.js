const express = require('express');
const router = express.Router();
const { protect, optionalProtect } = require('../middleware/auth');
const requireProUser = require('../middleware/requireProUser');
const ctrl = require('../controllers/proUserQuestionsController');
const rateLimit = require('express-rate-limit');

const createLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
const interactLimiter = rateLimit({ windowMs: 30 * 1000, max: 30 });

router.post('/userQuestions/create', protect, createLimiter, requireProUser, ctrl.createQuestion);
// Public list of approved questions (attach user if token present)
router.get('/userQuestions/public/list', optionalProtect, ctrl.listPublicQuestions);
router.get('/userQuestions/:id', protect, ctrl.getQuestion);
// Public increment view (no auth)
router.post('/userQuestions/:id/view', ctrl.incrementView);
router.post('/userQuestions/:id/answer', protect, interactLimiter, ctrl.answerQuestion);
router.post('/userQuestions/:id/like', protect, interactLimiter, ctrl.likeQuestion);
router.post('/userQuestions/:id/share', protect, interactLimiter, ctrl.shareQuestion);
router.get('/userQuestions/mine/list', protect, ctrl.listMyQuestions);
router.get('/userQuestions/monthly-count', protect, ctrl.getCurrentMonthQuestionCount);

module.exports = router;


