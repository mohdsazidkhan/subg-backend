const mongoose = require('mongoose');
const dotenv = require('dotenv');
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

// Migration strategy: Reset everyone to Level 0 and start fresh monthly system
const migrateToMonthlySystem = async () => {
  try {
    console.log('🔄 Starting FRESH START migration to monthly system...');
    console.log('⚠️  WARNING: This will reset ALL users to Level 0!');
    
    // Get count of users to migrate
    const totalUsers = await User.countDocuments({ role: 'student' });
    const alreadyMigrated = await User.countDocuments({ 
      role: 'student', 
      migratedToMonthlySystem: true 
    });
    
    console.log(`📊 Found ${totalUsers} student users total`);
    console.log(`📊 Already migrated: ${alreadyMigrated}`);
    console.log(`📊 Users to migrate: ${totalUsers - alreadyMigrated}`);
    
    if (totalUsers === 0) {
      console.log('✅ No users to migrate');
      return;
    }
    
    // Use bulk update for better performance and reliability
    console.log('🔄 Performing bulk update for all unmigrated users...');
    
    const bulkUpdateResult = await User.updateMany(
      { 
        role: 'student', 
        migratedToMonthlySystem: { $ne: true } 
      },
      {
        $set: {
          // Reset level fields
          'level.currentLevel': 0,
          'level.levelName': 'Starter',
          'level.quizzesPlayed': 0,
          'level.highScoreQuizzes': 0,
          'level.totalScore': 0,
          'level.averageScore': 0,
          'level.levelProgress': 0,
          'level.lastLevelUp': new Date(),
          
          // Reset monthly progress
          'monthlyProgress.highScoreWins': 0,
          'monthlyProgress.totalQuizAttempts': 0,
          'monthlyProgress.accuracy': 0,
          'monthlyProgress.currentLevel': 0,
          'monthlyProgress.rewardEligible': false,
          'monthlyProgress.rewardRank': null,
          'monthlyProgress.month': new Date().toISOString().slice(0, 7),
          
          // Reset rewards and subscription
          'claimableRewards': 0,
          'currentSubscription': null,
          'subscriptionStatus': 'free',
          'subscriptionExpiry': null,
          
          // Mark as migrated
          'migratedToMonthlySystem': true,
          'migrationDate': new Date(),
          'migrationDetails': {
            migrationType: 'fresh_start_monthly',
            resetReason: 'All users reset to Level 0 and subscription for fair monthly competition'
          }
        }
      }
    );
    
    console.log(`✅ Bulk update completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total users: ${totalUsers}`);
    console.log(`   - Already migrated: ${alreadyMigrated}`);
    console.log(`   - Newly migrated: ${bulkUpdateResult.modifiedCount}`);
    console.log(`   - Total migrated now: ${alreadyMigrated + bulkUpdateResult.modifiedCount}`);
    
    // Verify migration
    const finalMigratedCount = await User.countDocuments({ 
      role: 'student',
      migratedToMonthlySystem: true 
    });
    
    console.log(`\n🎯 All users now start at Level 0 with monthly reset system!`);
    console.log(`📅 Monthly rewards will be based on fresh monthly performance only.`);
    console.log(`✅ Migration verification: ${finalMigratedCount}/${totalUsers} users migrated`);
    
    // Show new monthly system info
    console.log(`\n🆕 New Monthly System:`);
    console.log(`   - Level 0: Starter (0 quizzes)`);
    console.log(`   - Level 1: Rookie (2 quizzes)`);
    console.log(`   - Level 2: Explorer (6 quizzes)`);
    console.log(`   - Level 3: Thinker (12 quizzes)`);
    console.log(`   - Level 4: Strategist (20 quizzes)`);
    console.log(`   - Level 5: Achiever (30 quizzes)`);
    console.log(`   - Level 6: Mastermind (42 quizzes)`);
    console.log(`   - Level 7: Champion (56 quizzes)`);
    console.log(`   - Level 8: Prodigy (72 quizzes)`);
    console.log(`   - Level 9: Wizard (90 quizzes)`);
    console.log(`   - Level 10: Legend (110 quizzes)`);
    console.log(`\n💰 Monthly Rewards: Top 3 users get ₹9,999 total in 3:2:1 ratio`);
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  }
};

// Run the migration
if (require.main === module) {
  migrateToMonthlySystem()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToMonthlySystem };
