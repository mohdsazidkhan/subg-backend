const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

// Test script to verify migration system without actually running it
const testMigration = async () => {
  try {
    console.log('🧪 Testing migration system (DRY RUN)...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Database Connected to MongoDB');
    
    // Get all student users
    const users = await User.find({ role: 'student' });
    console.log(`📊 Found ${users.length} student users to analyze`);
    
    // Analyze current user levels
    const levelDistribution = {};
    const subscriptionDistribution = {};
    let totalHighScoreQuizzes = 0;
    let usersWithRewards = 0;
    let totalClaimableRewards = 0;
    let usersWithPaidSubscription = 0;
    
          for (const user of users) {
        const level = user.level.currentLevel || 0;
        const highScoreQuizzes = user.level.highScoreQuizzes || 0;
        const claimableRewards = user.claimableRewards || 0;
        const subscriptionStatus = user.subscriptionStatus || 'free';
        
        // Count level distribution
        levelDistribution[level] = (levelDistribution[level] || 0) + 1;
        
        // Count subscription distribution
        subscriptionDistribution[subscriptionStatus] = (subscriptionDistribution[subscriptionStatus] || 0) + 1;
        
        // Sum total high score quizzes
        totalHighScoreQuizzes += highScoreQuizzes;
        
        // Count users with rewards
        if (claimableRewards > 0) {
          usersWithRewards++;
          totalClaimableRewards += claimableRewards;
        }
        
        // Count users with paid subscriptions
        if (subscriptionStatus !== 'free') {
          usersWithPaidSubscription++;
        }
      }
    
    console.log('\n📊 Current System Analysis:');
    console.log('============================');
    
    // Show level distribution
    console.log('\n🏆 Current Level Distribution:');
    Object.keys(levelDistribution).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
      const count = levelDistribution[level];
      const percentage = ((count / users.length) * 100).toFixed(1);
      console.log(`   Level ${level}: ${count} users (${percentage}%)`);
    });
    
    // Show subscription distribution
    console.log('\n💳 Current Subscription Distribution:');
    Object.keys(subscriptionDistribution).forEach(status => {
      const count = subscriptionDistribution[status];
      const percentage = ((count / users.length) * 100).toFixed(1);
      console.log(`   ${status.charAt(0).toUpperCase() + status.slice(1)}: ${count} users (${percentage}%)`);
    });
    
    // Show statistics
    console.log('\n📈 System Statistics:');
    console.log(`   - Total users: ${users.length}`);
    console.log(`   - Total high-score quizzes across all users: ${totalHighScoreQuizzes}`);
    console.log(`   - Average high-score quizzes per user: ${(totalHighScoreQuizzes / users.length).toFixed(1)}`);
    console.log(`   - Users with claimable rewards: ${usersWithRewards}`);
    console.log(`   - Total claimable rewards: ₹${totalClaimableRewards.toLocaleString()}`);
    console.log(`   - Users with paid subscriptions: ${usersWithPaidSubscription}`);
    
    // Show what would happen during migration
    console.log('\n🔄 Migration Preview (What Would Happen):');
    console.log('==========================================');
    console.log('   - All users would be reset to Level 0');
    console.log('   - All monthly progress would start from 0');
    console.log('   - All claimable rewards would be reset to ₹0');
    console.log('   - All subscriptions would be reset to Free');
    console.log('   - Users would start fresh monthly competition');
    
    // Show impact on rewards
    console.log('\n💰 Rewards Impact:');
    console.log('==================');
    console.log(`   - Current total claimable rewards: ₹${totalClaimableRewards.toLocaleString()}`);
    console.log(`   - After migration: ₹0 (fresh start)`);
    console.log(`   - Monthly rewards: Top 3 users get ₹9,999 total in 3:2:1 ratio`);
    console.log(`     • 1st Place: ₹4,999`);
    console.log(`     • 2nd Place: ₹3,333`);
    console.log(`     • 3rd Place: ₹1,667`);
    
    // Show migration readiness
    console.log('\n✅ Migration Readiness Check:');
    console.log('=============================');
    
    const alreadyMigrated = users.filter(u => u.migratedToMonthlySystem).length;
    const needsMigration = users.length - alreadyMigrated;
    
    console.log(`   - Users already migrated: ${alreadyMigrated}`);
    console.log(`   - Users needing migration: ${needsMigration}`);
    console.log(`   - Migration status: ${needsMigration > 0 ? '🟡 READY TO MIGRATE' : '🟢 ALREADY MIGRATED'}`);
    
    if (needsMigration > 0) {
      console.log('\n🚀 To run migration:');
      console.log('   node migrateToMonthlySystem.js');
    }
    
    // Show new monthly system info
    console.log('\n🆕 New Monthly System After Migration:');
    console.log('=======================================');
    console.log('   - Level 0: Starter (0 quizzes)');
    console.log('   - Level 1: Rookie (2 quizzes)');
    console.log('   - Level 2: Explorer (6 quizzes)');
    console.log('   - Level 3: Thinker (12 quizzes)');
    console.log('   - Level 4: Strategist (20 quizzes)');
    console.log('   - Level 5: Achiever (30 quizzes)');
    console.log('   - Level 6: Mastermind (42 quizzes)');
    console.log('   - Level 7: Champion (56 quizzes)');
    console.log('   - Level 8: Prodigy (72 quizzes)');
    console.log('   - Level 9: Wizard (90 quizzes)');
    console.log('   - Level 10: Legend (110 quizzes)');
    
    console.log('\n🧪 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

// Run the test
if (require.main === module) {
  testMigration()
    .then(() => {
      console.log('✅ Test script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testMigration };
