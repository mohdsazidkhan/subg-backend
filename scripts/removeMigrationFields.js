const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || "mongodb+srv://sajidpahat786:sajidpahat786@cluster0.dnrv0.mongodb.net/SubgQuiz?retryWrites=true&w=majority", {
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

// Remove migration fields from all users
const removeMigrationFields = async () => {
  try {
    console.log('🧹 Removing migration fields from all users...');
    
    // First, check if any users still have migration fields
    const usersWithMigrationFields = await User.find({
      $or: [
        { migratedToMonthlySystem: { $exists: true } },
        { migrationDate: { $exists: true } },
        { migrationDetails: { $exists: true } },
        { lockedRewards: { $exists: true } },
        { totalQuizzesPlayed: { $exists: true } }
      ]
    }).countDocuments();
    
    if (usersWithMigrationFields === 0) {
      console.log('✅ No migration fields found - all users are already clean!');
      return;
    }
    
    console.log(`📊 Found ${usersWithMigrationFields} users with migration fields to clean up`);
    
    // Remove migration fields from all users
    const cleanupResult = await User.updateMany(
      {}, // All users (not just students)
      {
        $unset: {
          migratedToMonthlySystem: "",
          migrationDate: "",
          migrationDetails: "",
          lockedRewards: "",
          totalQuizzesPlayed: ""
        }
      }
    );
    
    console.log(`✅ Cleanup completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   - Users processed: ${cleanupResult.matchedCount}`);
    console.log(`   - Users modified: ${cleanupResult.modifiedCount}`);
    
    // Verify cleanup
    const remainingUsersWithMigrationFields = await User.find({
      $or: [
        { migratedToMonthlySystem: { $exists: true } },
        { migrationDate: { $exists: true } },
        { migrationDetails: { $exists: true } },
        { lockedRewards: { $exists: true } },
        { totalQuizzesPlayed: { $exists: true } }
      ]
    }).countDocuments();
    
    if (remainingUsersWithMigrationFields === 0) {
      console.log('🎉 SUCCESS: All migration fields have been completely removed!');
    } else {
      console.log(`⚠️  WARNING: ${remainingUsersWithMigrationFields} users still have migration fields`);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run cleanup
removeMigrationFields();
