const mongoose = require('mongoose');
const User = require('../models/User');
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

// Verify migration fields are removed
const verifyMigrationFieldsRemoved = async () => {
  try {
    console.log('🔍 Verifying migration fields have been removed from all users...');
    
    // Check for users with migration fields
    const usersWithMigrationFields = await User.find({
      $or: [
        { migratedToMonthlySystem: { $exists: true } },
        { migrationDate: { $exists: true } },
        { migrationDetails: { $exists: true } },
        { lockedRewards: { $exists: true } },
        { totalQuizzesPlayed: { $exists: true } }
      ]
    }).select('name email migratedToMonthlySystem migrationDate migrationDetails lockedRewards totalQuizzesPlayed');
    
    if (usersWithMigrationFields.length === 0) {
      console.log('✅ SUCCESS: All migration fields have been completely removed!');
      console.log('🎉 No users have any migration-related fields remaining.');
    } else {
      console.log('⚠️  WARNING: Found users with migration fields still present:');
      console.log(`📊 Total users with migration fields: ${usersWithMigrationFields.length}`);
      
      usersWithMigrationFields.forEach((user, index) => {
        console.log(`\n👤 User ${index + 1}: ${user.name} (${user.email})`);
        if (user.migratedToMonthlySystem !== undefined) console.log(`   migratedToMonthlySystem: ${user.migratedToMonthlySystem}`);
        if (user.migrationDate !== undefined) console.log(`   migrationDate: ${user.migrationDate}`);
        if (user.migrationDetails !== undefined) console.log(`   migrationDetails: ${JSON.stringify(user.migrationDetails)}`);
        if (user.lockedRewards !== undefined) console.log(`   lockedRewards: ${JSON.stringify(user.lockedRewards)}`);
        if (user.totalQuizzesPlayed !== undefined) console.log(`   totalQuizzesPlayed: ${user.totalQuizzesPlayed}`);
      });
      
      console.log('\n🔄 To remove these fields, run: node cleanupYearlySystem.js');
    }
    
    // Check total user count
    const totalUsers = await User.countDocuments({ role: 'student' });
    console.log(`\n📊 Total student users in database: ${totalUsers}`);
    
    // Verify current field structure
    const usersWithCurrentFields = await User.countDocuments({
      'level.quizzesPlayed': { $exists: true },
      'monthlyProgress': { $exists: true }
    });
    
    console.log(`✅ Users with current field structure: ${usersWithCurrentFields}/${totalUsers}`);
    
    if (usersWithCurrentFields === totalUsers) {
      console.log('🎉 All users have the correct current field structure!');
    } else {
      console.log('⚠️  Some users may be missing current fields');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run verification
verifyMigrationFieldsRemoved();
