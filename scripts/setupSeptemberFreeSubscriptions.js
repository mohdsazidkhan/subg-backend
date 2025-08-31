const mongoose = require('mongoose');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || "", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Setup September free subscriptions for all users
const setupSeptemberFreeSubscriptions = async () => {
  try {
    console.log('🎯 Setting up September free subscriptions for all users...');
    
    // Get count of users to update
    const totalUsers = await User.countDocuments({ role: 'student' });
    console.log(`📊 Found ${totalUsers} student users to update`);
    
    if (totalUsers === 0) {
      console.log('✅ No users to update');
      return;
    }
    
    // Show current subscription distribution
    console.log('\n📊 Current Subscription Distribution:');
    const subscriptionStats = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $group: {
          _id: '$subscriptionStatus',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    subscriptionStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} users`);
    });
    
    // Set September 1st as the start date for free subscriptions
    const septemberStart = new Date('2024-09-01T00:00:00.000Z');
    const septemberEnd = new Date('2024-10-01T00:00:00.000Z');
    
    // First, create subscription records for all users
    console.log('\n🔄 Creating subscription records for September...');
    
    // Get all student users
    const allStudents = await User.find({ role: 'student' }).select('_id name email');
    
    // Create subscription records for each user
    const subscriptionPromises = allStudents.map(async (student) => {
      // Check if user already has an active subscription
      const existingSubscription = await Subscription.findOne({
        user: student._id,
        status: 'active'
      });
      
      if (existingSubscription) {
        // Update existing subscription to free for September
        return Subscription.findByIdAndUpdate(existingSubscription._id, {
          plan: 'free',
          status: 'active',
          startDate: septemberStart,
          endDate: septemberEnd,
          autoRenew: false,
          amount: 0,
          features: {
            unlimitedQuizzes: false,
            detailedAnalytics: false,
            prioritySupport: false,
            customCategories: false,
            advancedReports: false,
            exportData: false,
            apiAccess: false,
            whiteLabel: false
          },
          metadata: {
            setupType: 'september_free_setup',
            setupDate: new Date(),
            previousPlan: existingSubscription.plan
          }
        });
      } else {
        // Create new free subscription for September
        return Subscription.create({
          user: student._id,
          plan: 'free',
          status: 'active',
          startDate: septemberStart,
          endDate: septemberEnd,
          autoRenew: false,
          amount: 0,
          features: {
            unlimitedQuizzes: false,
            detailedAnalytics: false,
            prioritySupport: false,
            customCategories: false,
            advancedReports: false,
            exportData: false,
            apiAccess: false,
            whiteLabel: false
          },
          metadata: {
            setupType: 'september_free_setup',
            setupDate: new Date()
          }
        });
      }
    });
    
    const subscriptionResults = await Promise.all(subscriptionPromises);
    const newSubscriptions = subscriptionResults.filter(result => result !== null);
    
    console.log(`✅ Created/Updated ${newSubscriptions.length} subscription records`);
    
    // Now update all users to link to their subscriptions and reset progress
    console.log('\n🔄 Updating user records for September...');
    
    const updateResult = await User.updateMany(
      { role: 'student' },
      {
        $set: {
          subscriptionStatus: 'free',
          subscriptionExpiry: septemberEnd,
          // Reset monthly progress for September
          'monthlyProgress.month': '2024-09',
          'monthlyProgress.highScoreWins': 0,
          'monthlyProgress.totalQuizAttempts': 0,
          'monthlyProgress.accuracy': 0,
          'monthlyProgress.currentLevel': 0,
          'monthlyProgress.rewardEligible': false,
          'monthlyProgress.rewardRank': null,
          // Reset level for fresh start
          'level.currentLevel': 0,
          'level.levelName': 'Starter',
          'level.quizzesPlayed': 0,
          'level.highScoreQuizzes': 0,
          'level.totalScore': 0,
          'level.averageScore': 0,
          'level.levelProgress': 0,
          'level.lastLevelUp': septemberStart,
          // Reset claimable rewards
          claimableRewards: 0
        }
      }
    );
    
    console.log(`✅ September free subscriptions setup completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total users: ${totalUsers}`);
    console.log(`   - Subscription records created/updated: ${newSubscriptions.length}`);
    console.log(`   - Users updated: ${updateResult.modifiedCount}`);
    console.log(`   - September start: ${septemberStart.toDateString()}`);
    console.log(`   - September end: ${septemberEnd.toDateString()}`);
    
    // Verify setup
    const usersWithFreeSub = await User.countDocuments({
      role: 'student',
      subscriptionStatus: 'free'
    });
    
    const usersWithSeptemberProgress = await User.countDocuments({
      role: 'student',
      'monthlyProgress.month': '2024-09'
    });
    
    console.log(`\n✅ Verification:`);
    console.log(`   - Users with free subscription: ${usersWithFreeSub}/${totalUsers}`);
    console.log(`   - Users with September progress: ${usersWithSeptemberProgress}/${totalUsers}`);
    
    if (usersWithFreeSub === totalUsers && usersWithSeptemberProgress === totalUsers) {
      console.log('🎉 All users successfully set up for September free subscriptions!');
    } else {
      console.log('⚠️  Some users may not have been updated properly');
    }
    
    // Show sample user after setup
    const sampleUser = await User.findOne({ role: 'student' }).select('name subscriptionStatus subscriptionExpiry monthlyProgress level claimableRewards');
    console.log('\n📋 Sample user after September setup:');
    console.log(JSON.stringify(sampleUser, null, 2));
    
    console.log('\n🚀 All users are now ready for September monthly competition!');
    console.log('📅 Free subscription active until October 1st');
    console.log('🎯 Users can play Levels 0-3 for free');
    
  } catch (error) {
    console.error('❌ Error during September subscription setup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run setup
setupSeptemberFreeSubscriptions();
