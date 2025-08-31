const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || '', {
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

// Cleanup user badges
const cleanupUserBadges = async () => {
  try {
    console.log('🧹 Starting cleanup of user badges...');
    
    // Get count of users to clean up
    const totalUsers = await User.countDocuments({ role: 'student' });
    console.log(`📊 Found ${totalUsers} student users to clean up`);
    
    if (totalUsers === 0) {
      console.log('✅ No users to clean up');
      return;
    }
    
    // Show current badge distribution
    console.log('\n📊 Current Badge Distribution:');
    const badgeStats = await User.aggregate([
      { $match: { role: 'student' } },
      { $unwind: '$badges' },
      {
        $group: {
          _id: '$badges',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    badgeStats.forEach(badge => {
      console.log(`   ${badge._id}: ${badge.count} users`);
    });
    
    // Clean up badges for all users - reset to basic 'Student' badge
    console.log('\n🔄 Cleaning up user badges...');
    
    const cleanupResult = await User.updateMany(
      { role: 'student' },
      {
        $set: {
          badges: ['Student'] // Reset to basic Student badge only
        }
      }
    );
    
    console.log(`✅ Badge cleanup completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total users: ${totalUsers}`);
    console.log(`   - Users cleaned: ${cleanupResult.modifiedCount}`);
    
    // Verify cleanup
    const usersWithExtraBadges = await User.countDocuments({
      role: 'student',
      badges: { $ne: ['Student'] }
    });
    
    if (usersWithExtraBadges === 0) {
      console.log('✅ All user badges successfully reset to basic Student badge!');
    } else {
      console.log(`⚠️  ${usersWithExtraBadges} users still have extra badges`);
    }
    
    // Show final badge distribution
    console.log('\n📊 Final Badge Distribution:');
    const finalBadgeStats = await User.aggregate([
      { $match: { role: 'student' } },
      { $unwind: '$badges' },
      {
        $group: {
          _id: '$badges',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    finalBadgeStats.forEach(badge => {
      console.log(`   ${badge._id}: ${badge.count} users`);
    });
    
    // Show sample user after cleanup
    const sampleUser = await User.findOne({ role: 'student' }).select('name badges');
    console.log('\n📋 Sample user after badge cleanup:');
    console.log(JSON.stringify(sampleUser, null, 2));
    
    console.log('\n🎯 All users now have clean, basic Student badge only!');
    console.log('🚀 Ready for fresh monthly badge system!');
    
  } catch (error) {
    console.error('❌ Error during badge cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run cleanup
cleanupUserBadges();
