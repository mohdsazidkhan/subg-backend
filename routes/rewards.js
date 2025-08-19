const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const rewardsController = require('../controllers/rewardsController');

// Get user's rewards (locked, unlocked, claimed)
router.get('/user/rewards', protect, rewardsController.getUserRewards);

// Claim unlocked reward
router.post('/user/claim-reward', protect, rewardsController.claimReward);

// Admin: Process Level 10 leaderboard and unlock rewards
router.post('/admin/process-level10-leaderboard', admin, rewardsController.processLevel10Leaderboard);

// Admin: List users with rewards summary
router.get('/admin/users', admin, (req, res, next) => {
  // Optional filter: onlyLocked=1 shows only users who currently have locked rewards
  if (req.query.onlyLocked) {
    req.query.onlyLocked = String(req.query.onlyLocked).trim();
  }
  return rewardsController.getAdminRewardUsers(req, res, next);
});

// Lock reward for user (admin-only safeguard; automatic locking happens server-side on level up)
router.post('/lock-reward', admin, async (req, res) => {
  try {
    const { userId, level } = req.body;
    
    // Only allow locking rewards for Level 6 and 9
    if (![6, 9].includes(level)) {
      return res.status(400).json({ message: 'Can only lock rewards for Level 6 and 9' });
    }
    
    const result = await rewardsController.lockReward(userId, level);
    res.json(result);
  } catch (error) {
    console.error('Error in lock reward route:', error);
    res.status(500).json({ message: 'Error locking reward' });
  }
});

module.exports = router;
