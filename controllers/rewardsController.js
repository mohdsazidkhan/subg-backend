const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');

// Check if user is in Top 3 for a specific level
const isUserInTop3 = async (userId, level) => {
  try {
    // Get users at this level, sorted by performance
    const users = await User.find({
      role: 'student',
      'level.currentLevel': level
    })
    .select('_id level')
    .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
    .limit(3);
    
    if (!users || users.length === 0) return false;
    
    return users.some(user => user._id.toString() === userId.toString());
  } catch (error) {
    console.error('Error checking Top 3 status:', error);
    return false;
  }
};

// Check if user has completed required number of high-score quizzes
const hasCompletedRequiredQuizzes = async (userId) => {
  try {
    const user = await User.findById(userId).select('totalQuizzesPlayed');
    if (!user) return false;
    
    // totalQuizzesPlayed now represents high-score quizzes (75%+) only
    return user.totalQuizzesPlayed >= 1024;
  } catch (error) {
    console.error('Error checking quiz count:', error);
    return false;
  }
};

// Lock reward for user when they complete Level 6 or 9
// Note: This function is now deprecated in favor of the annual rewards system
// Rewards are automatically locked on August 1 (Level 6) and December 1 (Level 9)
const lockReward = async (userId, level) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, message: 'User not found' };

    // Check if user is in Top 3
    const isTop3 = await isUserInTop3(userId, level);
    if (!isTop3) return { success: false, message: 'User not in Top 3' };

    // Check if reward already exists
    const existingReward = user.lockedRewards.find(reward => reward.level === level);
    if (existingReward) return { success: false, message: 'Reward already locked' };

    // Define reward amounts
    const rewardAmounts = {
      6: 990,
      9: 9980,
      10: 99999
    };

    const newReward = {
      level,
      amount: rewardAmounts[level],
      isUnlocked: false,
      dateLocked: new Date()
    };

    user.lockedRewards.push(newReward);
    await user.save();

    return { 
      success: true, 
      message: `Reward of ₹${rewardAmounts[level]} locked for Level ${level}`,
      reward: newReward
    };
  } catch (error) {
    console.error('Error locking reward:', error);
    return { success: false, message: 'Error locking reward' };
  }
};

// Unlock rewards when user reaches Level 10 Top 3 and completes 1024 quizzes
// Note: This function is now part of the annual rewards system (Phase 3 on March 31)
const unlockRewards = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, message: 'User not found' };

    // Check if user is in Top 3 at Level 10
    const isTop3Level10 = await isUserInTop3(userId, 10);
    if (!isTop3Level10) return { success: false, message: 'User not in Top 3 at Level 10' };

    // Check if user has completed 1024 quizzes
    const hasRequiredQuizzes = await hasCompletedRequiredQuizzes(userId);
    if (!hasRequiredQuizzes) return { success: false, message: 'User has not completed 1024 quizzes' };

    let totalUnlocked = 0;
    const updatedRewards = user.lockedRewards.map(reward => {
      if (!reward.isUnlocked && !reward.isClaimed) {
        reward.isUnlocked = true;
        reward.dateUnlocked = new Date();
        totalUnlocked += reward.amount;
      }
      return reward;
    });

    user.lockedRewards = updatedRewards;
    await user.save();

    return { 
      success: true, 
      message: `Unlocked rewards worth ₹${totalUnlocked}`,
      totalUnlocked
    };
  } catch (error) {
    console.error('Error unlocking rewards:', error);
    return { success: false, message: 'Error unlocking rewards' };
  }
};

// Get user's rewards (locked, unlocked, claimed)
const getUserRewards = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('lockedRewards claimableRewards totalQuizzesPlayed');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Use totalQuizzesPlayed which now represents high-score quizzes (75%+) only
    const highScoreQuizCount = user.totalQuizzesPlayed || 0;

    // Check if user is in Top 3 at Level 10
    const isTop3Level10 = await isUserInTop3(userId, 10);
    const hasRequiredQuizzes = highScoreQuizCount >= 1024;

    const rewards = {
      locked: user.lockedRewards.filter(r => !r.isUnlocked),
      unlocked: user.lockedRewards.filter(r => r.isUnlocked && !r.isClaimed),
      claimed: user.lockedRewards.filter(r => r.isClaimed),
      claimableRewards: user.claimableRewards,
      quizProgress: {
        current: highScoreQuizCount,
        required: 1024,
        percentage: Math.min((highScoreQuizCount / 1024) * 100, 100)
      },
      canUnlock: isTop3Level10 && hasRequiredQuizzes
    };

    res.json(rewards);
  } catch (error) {
    console.error('Error getting user rewards:', error);
    res.status(500).json({ message: 'Error getting user rewards' });
  }
};

// Claim unlocked rewards
const claimReward = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rewardId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const reward = user.lockedRewards.id(rewardId);
    if (!reward) {
      return res.status(404).json({ message: 'Reward not found' });
    }

    if (!reward.isUnlocked) {
      return res.status(400).json({ message: 'Reward is not unlocked yet' });
    }

    if (reward.isClaimed) {
      return res.status(400).json({ message: 'Reward already claimed' });
    }

    // Mark reward as claimed
    reward.isClaimed = true;
    reward.dateClaimed = new Date();
    
    // Add to claimable rewards (this would typically go to wallet/bank)
    user.claimableRewards += reward.amount;
    
    await user.save();

    res.json({ 
      message: `Successfully claimed ₹${reward.amount}`,
      claimedAmount: reward.amount,
      totalClaimable: user.claimableRewards
    });
  } catch (error) {
    console.error('Error claiming reward:', error);
    res.status(500).json({ message: 'Error claiming reward' });
  }
};

// Admin function to process Level 10 leaderboard and unlock rewards
const processLevel10Leaderboard = async (req, res) => {
  try {
    // Get Top 3 users from Level 10
    const level10Users = await User.find({
      role: 'student',
      'level.currentLevel': 10
    })
    .select('_id level')
    .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
    .limit(3);

    if (!level10Users || level10Users.length === 0) {
      return res.status(404).json({ message: 'No users found at Level 10' });
    }

    const results = [];
    
    for (const user of level10Users) {
      const userId = user._id;
      const result = await unlockRewards(userId);
      results.push({
        userId,
        result
      });
    }

    res.json({ 
      message: 'Level 10 leaderboard processed',
      results 
    });
  } catch (error) {
    console.error('Error processing Level 10 leaderboard:', error);
    res.status(500).json({ message: 'Error processing leaderboard' });
  }
};

module.exports = {
  lockReward,
  unlockRewards,
  getUserRewards,
  claimReward,
  processLevel10Leaderboard,
  isUserInTop3,
  hasCompletedRequiredQuizzes
};

// Admin: List users with rewards summary (pagination + search)
// Keeping function definition after module.exports to avoid hoisting surprises in older tooling
module.exports.getAdminRewardUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const search = (req.query.search || '').trim();
    const levelFilter = req.query.level ? Number(req.query.level) : undefined;

    const query = { role: 'student' };
    if (levelFilter && !Number.isNaN(levelFilter)) {
      query['level.currentLevel'] = levelFilter;
    }

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { referralCode: regex }
      ];
    }

    // Optional filter: only users who currently have locked rewards
    const onlyLocked = req.query.onlyLocked && req.query.onlyLocked !== '0';

    const countQuery = onlyLocked ? { ...query, 'lockedRewards.isUnlocked': false } : query;
    const total = await User.countDocuments(countQuery);

    const findQuery = onlyLocked ? { ...query, 'lockedRewards.isUnlocked': false } : query;
    const users = await User.find(findQuery)
      .select('name email phone level lockedRewards claimableRewards totalQuizzesPlayed createdAt')
      .sort({ 'level.currentLevel': -1, 'level.highScoreQuizzes': -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const usersWithSummary = users.map(u => {
      let totalLocked = 0;
      let totalUnlocked = 0;
      let totalClaimed = 0;
      let lockedCount = 0;
      let unlockedCount = 0;
      let claimedCount = 0;
      const lockedLevels = [];

      (u.lockedRewards || []).forEach(r => {
        if (r.isClaimed) {
          totalClaimed += r.amount || 0;
          claimedCount += 1;
        } else if (r.isUnlocked) {
          totalUnlocked += r.amount || 0;
          unlockedCount += 1;
        } else {
          totalLocked += r.amount || 0;
          lockedCount += 1;
          if (typeof r.level === 'number') lockedLevels.push(r.level);
        }
      });

      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        level: u.level,
        totalQuizzesPlayed: u.totalQuizzesPlayed || 0,
        claimableRewards: u.claimableRewards || 0,
        totals: {
          locked: totalLocked,
          unlocked: totalUnlocked,
          claimed: totalClaimed
        },
        counts: {
          locked: lockedCount,
          unlocked: unlockedCount,
          claimed: claimedCount
        },
        lockedLevels,
        createdAt: u.createdAt
      };
    });

    const pagination = {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit))
    };

    return res.json({ users: usersWithSummary, pagination });
  } catch (error) {
    console.error('Error listing reward users (admin):', error);
    return res.status(500).json({ message: 'Error fetching rewards users' });
  }
};
