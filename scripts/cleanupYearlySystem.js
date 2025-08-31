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

// Cleanup yearly system data
const cleanupYearlySystem = async () => {
  try {
    console.log('🧹 Starting cleanup of yearly system data...');
    
    // Get count of users to clean up
    const totalUsers = await User.countDocuments({ role: 'student' });
    console.log(`📊 Found ${totalUsers} student users to clean up`);
    
    if (totalUsers === 0) {
      console.log('✅ No users to clean up');
      return;
    }
    
    // Clean up legacy fields for all users
    console.log('🔄 Cleaning up legacy yearly system fields...');
    
    const cleanupResult = await User.updateMany(
      { role: 'student' },
      {
        $unset: {
          // Remove legacy locked rewards
          lockedRewards: "",
          totalQuizzesPlayed: "",
          
          // Remove migration tracking fields
          migratedToMonthlySystem: "",
          migrationDate: "",
          migrationDetails: ""
        }
      }
    );
    
    // Clean up user badges - reset to basic Student badge
    console.log('🔄 Cleaning up user badges...');
    
    const badgeCleanupResult = await User.updateMany(
      { role: 'student' },
      {
        $set: {
          badges: ['Student'] // Reset to basic Student badge only
        }
      }
    );
    
    // Setup September free subscriptions for all users
    console.log('🔄 Setting up September free subscriptions...');
    
    const septemberStart = new Date('2024-09-01T00:00:00.000Z');
    const septemberEnd = new Date('2024-10-01T00:00:00.000Z');
    
    // First, create subscription records for all users
    console.log('🔄 Creating subscription records for September...');
    
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
    const subscriptionResult = await User.updateMany(
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
    
    console.log(`✅ Cleanup and September setup completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total users: ${totalUsers}`);
    console.log(`   - Users cleaned: ${cleanupResult.modifiedCount}`);
    console.log(`   - Badges reset: ${badgeCleanupResult.modifiedCount}`);
    console.log(`   - Subscription records created/updated: ${newSubscriptions.length}`);
    console.log(`   - September subscriptions: ${subscriptionResult.modifiedCount}`);
    console.log(`   - September period: ${septemberStart.toDateString()} to ${septemberEnd.toDateString()}`);
    
    // Verify cleanup
    const usersWithLegacyFields = await User.countDocuments({
      role: 'student',
      $or: [
        { lockedRewards: { $exists: true } },
        { totalQuizzesPlayed: { $exists: true } },
        { migratedToMonthlySystem: { $exists: true } },
        { migrationDate: { $exists: true } },
        { migrationDetails: { $exists: true } }
      ]
    });
    
    if (usersWithLegacyFields === 0) {
      console.log('✅ All legacy fields successfully removed!');
    } else {
      console.log(`⚠️  ${usersWithLegacyFields} users still have legacy fields`);
    }
    
    // Show current user structure
    const sampleUser = await User.findOne({ role: 'student' }).select('monthlyProgress level claimableRewards');
    console.log('\n📋 Current user structure after cleanup:');
    console.log(JSON.stringify(sampleUser, null, 2));
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run cleanup
cleanupYearlySystem();
