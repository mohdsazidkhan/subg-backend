const User = require('../models/User');
const { lockReward } = require('../controllers/rewardsController');

// Check if user should get a locked reward for completing a level
const checkAndLockReward = async (userId, level) => {
  try {
    // Only check for Level 6 and 9
    if (![6, 9].includes(level)) {
      return { shouldLock: false, message: 'Level not eligible for locked rewards' };
    }

    // Check if user is in Top 3 for this level using User model
    const top3Users = await User.find({
      role: 'student',
      'level.currentLevel': level
    })
    .select('_id level')
    .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
    .limit(3);

    if (!top3Users || top3Users.length === 0) {
      return { shouldLock: false, message: 'No users found at this level' };
    }

    const isTop3 = top3Users.some(user => user._id.toString() === userId.toString());
    
    if (!isTop3) {
      return { shouldLock: false, message: 'User not in Top 3 for this level' };
    }

    // Check if user already has this reward locked
    const user = await User.findById(userId);
    if (!user) {
      return { shouldLock: false, message: 'User not found' };
    }

    const existingReward = user.lockedRewards.find(reward => reward.level === level);
    if (existingReward) {
      return { shouldLock: false, message: 'Reward already locked for this level' };
    }

    // Lock the reward
    const result = await lockReward(userId, level);
    
    if (result.success) {
      return { 
        shouldLock: true, 
        message: result.message,
        reward: result.reward
      };
    } else {
      return { shouldLock: false, message: result.message };
    }

  } catch (error) {
    console.error('Error checking and locking reward:', error);
    return { shouldLock: false, message: 'Error processing reward' };
  }
};

// Note: Quiz count is now automatically updated in User.addQuizCompletion()
// This function is deprecated and kept for backward compatibility
const updateQuizCount = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return false;

    // totalQuizzesPlayed is now automatically managed in addQuizCompletion
    // This function is no longer needed but kept for compatibility
    return true;
  } catch (error) {
    console.error('Error updating quiz count:', error);
    return false;
  }
};

// Check if user meets all requirements to unlock rewards
const checkUnlockRequirements = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { canUnlock: false, message: 'User not found' };

    // Check if user has any locked rewards
    const hasLockedRewards = user.lockedRewards.some(reward => !reward.isUnlocked);
    if (!hasLockedRewards) {
      return { canUnlock: false, message: 'No locked rewards to unlock' };
    }

    // Check if user is in Top 3 at Level 10
    const level10Users = await User.find({
      role: 'student',
      'level.currentLevel': 10
    })
    .select('_id level')
    .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
    .limit(3);

    if (!level10Users || level10Users.length === 0) {
      return { canUnlock: false, message: 'No users found at Level 10' };
    }

    const isTop3Level10 = level10Users.some(user => user._id.toString() === userId.toString());
    if (!isTop3Level10) {
      return { canUnlock: false, message: 'User not in Top 3 at Level 10' };
    }

    // Check quiz count requirement
    const quizCount = user.totalQuizzesPlayed || 0;
    const hasRequiredQuizzes = quizCount >= 1024;

    if (!hasRequiredQuizzes) {
      return { 
        canUnlock: false, 
        message: `User needs ${1024 - quizCount} more quizzes to unlock rewards`,
        quizProgress: { current: quizCount, required: 1024 }
      };
    }

    return { 
      canUnlock: true, 
      message: 'User meets all requirements to unlock rewards',
      quizProgress: { current: quizCount, required: 1024 }
    };

  } catch (error) {
    console.error('Error checking unlock requirements:', error);
    return { canUnlock: false, message: 'Error checking requirements' };
  }
};

// Get reward summary for user
const getRewardSummary = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    const summary = {
      totalLocked: 0,
      totalUnlocked: 0,
      totalClaimed: 0,
      claimableRewards: user.claimableRewards || 0,
      quizProgress: {
        current: user.totalQuizzesPlayed || 0,
        required: 1024,
        percentage: 0
      }
    };

    user.lockedRewards.forEach(reward => {
      if (reward.isClaimed) {
        summary.totalClaimed += reward.amount;
      } else if (reward.isUnlocked) {
        summary.totalUnlocked += reward.amount;
      } else {
        summary.totalLocked += reward.amount;
      }
    });

    summary.quizProgress.percentage = Math.min(
      (summary.quizProgress.current / summary.quizProgress.required) * 100, 
      100
    );

    return summary;
  } catch (error) {
    console.error('Error getting reward summary:', error);
    return null;
  }
};

module.exports = {
  checkAndLockReward,
  updateQuizCount,
  checkUnlockRequirements,
  getRewardSummary
};
