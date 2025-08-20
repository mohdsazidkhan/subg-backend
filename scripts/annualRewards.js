const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cron = require('node-cron');
const User = require('../models/User');

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Database Connected to MongoDB');
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// Function to get Top 3 users for a specific level using existing leaderboard logic
const getTop3ForLevel = async (level) => {
  try {
    const users = await User.find({
      role: 'student',
      [`level${level}.completed`]: true,
      [`level${level}.completedAt`]: { $lte: new Date() }
    })
    .select('_id level lockedRewards')
    .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
    .limit(3);

    return users;
  } catch (error) {
    console.error(`❌ Error getting Top 3 for Level ${level}:`, error);
    return [];
  }
};

// Phase 1: August 1 - Lock ₹990 for Level 6 Top 3
const phase1Level6Lock = async () => {
  try {
    console.log('🎯 PHASE 1: Starting Level 6 rewards locking (August 1)...');
    
    const top3Users = await getTop3ForLevel(6);
    
    if (top3Users.length === 0) {
      console.log('ℹ️ No users found for Level 6 rewards');
      return;
    }

    let lockedCount = 0;
    for (const user of top3Users) {
      try {
        // Check if user already has Level 6 reward locked
        const existingReward = user.lockedRewards.find(reward => reward.level === 6);
        
        if (!existingReward) {
          // Lock the reward
          const newReward = {
            level: 6,
            amount: 990,
            isUnlocked: false,
            dateLocked: new Date('2025-08-01')
          };
          
          user.lockedRewards.push(newReward);
          await user.save();
          
          console.log(`✅ Locked ₹990 for Level 6 user: ${user._id}`);
          lockedCount++;
        } else {
          console.log(`ℹ️ User ${user._id} already has Level 6 reward locked`);
        }
      } catch (userError) {
        console.error(`❌ Error processing user ${user._id}:`, userError);
      }
    }
    
    console.log(`✅ PHASE 1 completed: ${lockedCount} Level 6 rewards locked`);
  } catch (error) {
    console.error('❌ Error in Phase 1 (Level 6):', error);
  }
};

// Phase 2: December 1 - Lock ₹9,980 for Level 9 Top 3
const phase2Level9Lock = async () => {
  try {
    console.log('🎯 PHASE 2: Starting Level 9 rewards locking (December 1)...');
    
    const top3Users = await getTop3ForLevel(9);
    
    if (top3Users.length === 0) {
      console.log('ℹ️ No users found for Level 9 rewards');
      return;
    }

    let lockedCount = 0;
    for (const user of top3Users) {
      try {
        // Check if user already has Level 9 reward locked
        const existingReward = user.lockedRewards.find(reward => reward.level === 9);
        
        if (!existingReward) {
          // Lock the reward
          const newReward = {
            level: 9,
            amount: 9980,
            isUnlocked: false,
            dateLocked: new Date('2025-12-01')
          };
          
          user.lockedRewards.push(newReward);
          await user.save();
          
          console.log(`✅ Locked ₹9,980 for Level 9 user: ${user._id}`);
          lockedCount++;
        } else {
          console.log(`ℹ️ User ${user._id} already has Level 9 reward locked`);
        }
      } catch (userError) {
        console.error(`❌ Error processing user ${user._id}:`, userError);
      }
    }
    
    console.log(`✅ PHASE 2 completed: ${lockedCount} Level 9 rewards locked`);
  } catch (error) {
    console.error('❌ Error in Phase 2 (Level 9):', error);
  }
};

// Phase 3: March 31 - Unlock all rewards for Level 10 Top 3
const phase3Level10Unlock = async () => {
  try {
    console.log('🎯 PHASE 3: Starting Level 10 rewards unlocking (March 31)...');
    
    const top3Users = await getTop3ForLevel(10);
    
    if (top3Users.length === 0) {
      console.log('ℹ️ No users found for Level 10 rewards');
      return;
    }

    let unlockedCount = 0;
    for (let i = 0; i < top3Users.length; i++) {
      const user = top3Users[i];
      try {
        // Check if user has played 1024 or more quizzes
        if (user.totalQuizzesPlayed >= 1024) {
          // Unlock all locked rewards
          let totalUnlocked = 0;
          const updatedRewards = user.lockedRewards.map(reward => {
            if (!reward.isUnlocked) {
              reward.isUnlocked = true;
              reward.dateUnlocked = new Date();
              totalUnlocked += reward.amount;
            }
            return reward;
          });
          
          // Add Level 10 share from ₹99,999 pool
          const level10Shares = [49999.50, 33333.00, 16666.50];
          const level10Share = level10Shares[i] || 0;
          
          user.lockedRewards = updatedRewards;
          user.claimableRewards = (user.claimableRewards || 0) + totalUnlocked + level10Share;
          
          await user.save();
          
          console.log(`✅ Unlocked rewards for Level 10 user ${user._id}: ₹${totalUnlocked} + ₹${level10Share} = ₹${totalUnlocked + level10Share}`);
          unlockedCount++;
        } else {
          console.log(`ℹ️ User ${user._id} needs ${1024 - user.totalQuizzesPlayed} more quizzes to unlock rewards`);
        }
      } catch (userError) {
        console.error(`❌ Error processing user ${user._id}:`, userError);
      }
    }
    
    console.log(`✅ PHASE 3 completed: ${unlockedCount} Level 10 rewards unlocked`);
  } catch (error) {
    console.error('❌ Error in Phase 3 (Level 10):', error);
  }
};

// Schedule annual rewards processing
const scheduleAnnualRewards = () => {
  console.log('📅 Scheduling annual rewards processing...');
  
  // Phase 1: August 1 at 12:00 AM IST
  cron.schedule('0 0 1 8 *', () => {
    console.log('⏰ August 1: Running Phase 1 (Level 6 rewards locking)...');
    phase1Level6Lock();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  
  // Phase 2: December 1 at 12:00 AM IST
  cron.schedule('0 0 1 12 *', () => {
    console.log('⏰ December 1: Running Phase 2 (Level 9 rewards locking)...');
    phase2Level9Lock();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  
  // Phase 3: March 31 at 12:00 AM IST
  cron.schedule('0 0 31 3 *', () => {
    console.log('⏰ March 31: Running Phase 3 (Level 10 rewards unlocking)...');
    phase3Level10Unlock();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  
  console.log('✅ Annual rewards processing scheduled:');
  console.log('   - Phase 1 (Level 6): August 1 at 12:00 AM IST');
  console.log('   - Phase 2 (Level 9): December 1 at 12:00 AM IST');
  console.log('   - Phase 3 (Level 10): March 31 at 12:00 AM IST');
};

// Manual execution functions for testing
const runPhase1Manually = async () => {
  console.log('🚀 Running Phase 1 (Level 6) manually...');
  await phase1Level6Lock();
  process.exit(0);
};

const runPhase2Manually = async () => {
  console.log('🚀 Running Phase 2 (Level 9) manually...');
  await phase2Level9Lock();
  process.exit(0);
};

const runPhase3Manually = async () => {
  console.log('🚀 Running Phase 3 (Level 10) manually...');
  await phase3Level10Unlock();
  process.exit(0);
};

// Check command line arguments for manual execution
if (require.main === module) {
  const phase = process.argv[2];
  
  switch (phase) {
    case 'phase1':
      runPhase1Manually();
      break;
    case 'phase2':
      runPhase2Manually();
      break;
    case 'phase3':
      runPhase3Manually();
      break;
    default:
      console.log('Usage: node annualRewards.js [phase1|phase2|phase3]');
      console.log('Or import the module to use scheduled execution');
      process.exit(1);
  }
} else {
  // Export for use in other modules
  module.exports = {
    phase1Level6Lock,
    phase2Level9Lock,
    phase3Level10Unlock,
    scheduleAnnualRewards
  };
}

// Start scheduling if not run manually
if (require.main !== module) {
  scheduleAnnualRewards();
}
