const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI || '', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Reset student user data
const resetStudentUserData = async () => {
  try {
    console.log('🧹 Starting reset of student user data...');

    // Count target users
    const totalUsers = await User.countDocuments({ role: 'student' });
    console.log(`📊 Found ${totalUsers} student users to reset`);

    if (totalUsers === 0) {
      console.log('✅ No users to reset');
      return;
    }

    // Optional: show current badge distribution before reset
    console.log('\n📊 Current Badge Distribution (before reset):');
    const badgeStats = await User.aggregate([
      { $match: { role: 'student' } },
      { $unwind: '$badges' },
      {
        $group: {
          _id: '$badges',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
    if (badgeStats.length === 0) {
      console.log('   (no badges found)');
    } else {
      badgeStats.forEach((badge) => {
        console.log(`   ${badge._id}: ${badge.count} users`);
      });
    }

    // Desired default state
    const defaultState = {
      badges: ['Student'],
      level: {
        currentLevel: 1,
        levelName: 'Starter',
        quizzesPlayed: 0,
        highScoreQuizzes: 0,
        totalScore: 0,
        averageScore: 0,
        levelProgress: 0,
        lastLevelUp: '',
      },
      totalQuizzesPlayed: 0,
      quizBestScores: [],
    };

    console.log('\n🔄 Resetting user data to defaults...');

    const resetResult = await User.updateMany(
      { role: 'student' },
      {
        $set: defaultState,
      }
    );

    console.log('✅ User data reset completed!');
    console.log('📊 Summary:');
    console.log(`   - Total users: ${totalUsers}`);
    console.log(`   - Users updated: ${resetResult.modifiedCount}`);

    // Verify badges specifically
    const usersWithNonDefaultBadges = await User.countDocuments({
      role: 'student',
      badges: { $ne: ['Student'] },
    });

    if (usersWithNonDefaultBadges === 0) {
      console.log('✅ All user badges set to ["Student"].');
    } else {
      console.log(`⚠️  ${usersWithNonDefaultBadges} users still have non-default badges.`);
    }

    // Show final badge distribution
    console.log('\n📊 Final Badge Distribution (after reset):');
    const finalBadgeStats = await User.aggregate([
      { $match: { role: 'student' } },
      { $unwind: '$badges' },
      {
        $group: {
          _id: '$badges',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
    if (finalBadgeStats.length === 0) {
      console.log('   (no badges found)');
    } else {
      finalBadgeStats.forEach((badge) => {
        console.log(`   ${badge._id}: ${badge.count} users`);
      });
    }

    // Show sample user after reset
    const sampleUser = await User.findOne({ role: 'student' }).select(
      'name badges level totalQuizzesPlayed quizBestScores'
    );
    console.log('\n📋 Sample user after reset:');
    console.log(JSON.stringify(sampleUser, null, 2));

    console.log('\n🎯 All student users now have default progress and badges!');
  } catch (error) {
    console.error('❌ Error during user data reset:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run
resetStudentUserData();


