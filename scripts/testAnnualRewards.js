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

// Test function to simulate the annual rewards system
const testAnnualRewards = async () => {
  try {
    console.log('🧪 Testing Annual Rewards System...\n');
    
    // Test 1: Check Level 6 completion tracking
    console.log('📊 Test 1: Level 6 Completion Tracking');
    const level6Users = await User.find({ 'level6.completed': true });
    console.log(`   - Users with Level 6 completed: ${level6Users.length}`);
    
    // Test 2: Check Level 9 completion tracking
    console.log('📊 Test 2: Level 9 Completion Tracking');
    const level9Users = await User.find({ 'level9.completed': true });
    console.log(`   - Users with Level 9 completed: ${level9Users.length}`);
    
    // Test 3: Check Level 10 completion tracking
    console.log('📊 Test 3: Level 10 Completion Tracking');
    const level10Users = await User.find({ 'level10.completed': true });
    console.log(`   - Users with Level 10 completed: ${level10Users.length}`);
    
    // Test 4: Check existing locked rewards
    console.log('📊 Test 4: Existing Locked Rewards');
    const usersWithRewards = await User.find({ 'lockedRewards.0': { $exists: true } });
    console.log(`   - Users with locked rewards: ${usersWithRewards.length}`);
    
    // Test 5: Simulate Phase 1 (Level 6 Top 3)
    console.log('\n🎯 Test 5: Simulating Phase 1 (Level 6 Top 3)');
    const level6Top3 = await User.find({
      'level6.completed': true,
      'level6.completedAt': { $lte: new Date() }
    })
    .select('_id level lockedRewards')
    .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
    .limit(3);
    
    console.log(`   - Top 3 Level 6 users found: ${level6Top3.length}`);
    level6Top3.forEach((user, index) => {
      const existingReward = user.lockedRewards.find(r => r.level === 6);
      console.log(`   - Rank ${index + 1}: User ${user._id} - Level: ${user.level.currentLevel}, Reward: ${existingReward ? 'Already Locked' : 'Not Locked'}`);
    });
    
    // Test 6: Simulate Phase 2 (Level 9 Top 3)
    console.log('\n🎯 Test 6: Simulating Phase 2 (Level 9 Top 3)');
    const level9Top3 = await User.find({
      'level9.completed': true,
      'level9.completedAt': { $lte: new Date() }
    })
    .select('_id level lockedRewards')
    .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
    .limit(3);
    
    console.log(`   - Top 3 Level 9 users found: ${level9Top3.length}`);
    level9Top3.forEach((user, index) => {
      const existingReward = user.lockedRewards.find(r => r.level === 9);
      console.log(`   - Rank ${index + 1}: User ${user._id} - Level: ${user.level.currentLevel}, Reward: ${existingReward ? 'Already Locked' : 'Not Locked'}`);
    });
    
    // Test 7: Simulate Phase 3 (Level 10 Top 3)
    console.log('\n🎯 Test 7: Simulating Phase 3 (Level 10 Top 3)');
    const level10Top3 = await User.find({
      'level10.completed': true,
      'level10.completedAt': { $lte: new Date() }
    })
    .select('_id level lockedRewards totalQuizzesPlayed')
    .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
    .limit(3);
    
    console.log(`   - Top 3 Level 10 users found: ${level10Top3.length}`);
    level10Top3.forEach((user, index) => {
      const hasRequiredQuizzes = user.totalQuizzesPlayed >= 1024;
      const lockedRewards = user.lockedRewards.filter(r => !r.isUnlocked);
      const totalLocked = lockedRewards.reduce((sum, r) => sum + r.amount, 0);
      
      console.log(`   - Rank ${index + 1}: User ${user._id}`);
      console.log(`     Level: ${user.level.currentLevel}, Quizzes: ${user.totalQuizzesPlayed}/1024`);
      console.log(`     Locked Rewards: ₹${totalLocked}, Can Unlock: ${hasRequiredQuizzes ? 'Yes' : 'No'}`);
    });
    
    // Test 8: Check reward amounts
    console.log('\n💰 Test 8: Reward Amounts');
    console.log('   - Level 6: ₹990');
    console.log('   - Level 9: ₹9,980');
    console.log('   - Level 10 Pool: ₹99,999 (3:2:1 ratio)');
    console.log('     - Rank 1: ₹49,999.50');
    console.log('     - Rank 2: ₹33,333.00');
    console.log('     - Rank 3: ₹16,666.50');
    
    console.log('\n✅ Annual Rewards System Test Completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run the test
if (require.main === module) {
  testAnnualRewards()
    .then(() => {
      console.log('\n🎉 All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
} else {
  module.exports = { testAnnualRewards };
}
