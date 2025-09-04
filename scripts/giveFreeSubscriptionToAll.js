const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
dotenv.config();

/**
 * Give free subscription to all users in the database for 1 month
 * Usage: node scripts/giveFreeSubscriptionToAll.js
 */
async function giveFreeSubscriptionToAll() {
  try {
    console.log('🚀 Starting to give free subscriptions to all users...');
    
    // Find all users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users in the database`);
    
    if (users.length === 0) {
      console.log('⚠️  No users found in the database');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process each user
    for (const user of users) {
      try {
        console.log(`\n👤 Processing user: ${user.name} (${user.email})`);
        
        // Check if user already has an active subscription
        const existingSubscription = await Subscription.findOne({
          user: user._id,
          status: 'active',
          endDate: { $gt: new Date() } // Not expired
        });
        
        if (existingSubscription) {
          console.log(`   ⚠️  User already has active subscription: ${existingSubscription.plan}`);
          continue;
        }
        
        // Create free subscription for 1 month
        const subscription = new Subscription({
          user: user._id,
          plan: 'free',
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month validity
          amount: 0,
          currency: 'INR',
          paymentMethod: 'free_trial'
        });
        
        await subscription.save();
        console.log(`   ✅ Created free subscription: ${subscription._id}`);
        
        // Update user subscription fields
        user.subscriptionStatus = 'free';
        user.currentSubscription = subscription._id;
        user.subscriptionExpiry = subscription.endDate;
        await user.save();
        
        console.log(`   ✅ Updated user subscription status`);
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ Error processing user ${user.email}:`, error.message);
        errors.push({ user: user.email, error: error.message });
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully processed: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log(`📅 Free subscription valid for: 1 month`);
    console.log(`🎯 All users now have free subscription access`);
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      errors.forEach(({ user, error }) => {
        console.log(`   - ${user}: ${error}`);
      });
    }
    
    console.log('\n🎉 Free subscription assignment completed!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  // Connect to MongoDB
  mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
  })
    .then(async () => {
      try {
        console.log('✅ Connected to MongoDB');
        await giveFreeSubscriptionToAll();
      } catch (err) {
        console.error('❌ Error:', err.message);
      } finally {
        await mongoose.disconnect();
        console.log('🔌 Database connection closed');
      }
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    });
}

module.exports = giveFreeSubscriptionToAll;
