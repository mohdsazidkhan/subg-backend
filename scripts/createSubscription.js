const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
dotenv.config();
/**
 * Create a subscription for a user by email or phone.
 * Usage: node scripts/createSubscription.js <email-or-phone> <plan>
 */
async function createSubscription(identifier, plan) {
  // Find user by email or phone
  const user = await User.findOne({
    $or: [{ email: identifier }, { phone: identifier }]
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Create subscription entry
  const subscription = new Subscription({
    user: user._id,
    plan,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year validity
  });

  await subscription.save();

  // Update user subscription fields
  user.subscriptionStatus = plan;
  user.currentSubscription = subscription._id;
  user.subscriptionExpiry = subscription.endDate;
  await user.save();

  return subscription;
}

// CLI usage
if (require.main === module) {
  const [,, identifier, plan] = process.argv;
  if (!identifier || !plan) {
    console.log(`Usage: node scripts/createSubscription.js ${identifier} ${plan}`);
    process.exit(1);
  }

  // Connect to MongoDB (update your connection string if needed)
  mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
      try {
        const sub = await createSubscription(identifier, plan);
        console.log('Subscription created:', sub);
      } catch (err) {
        console.error(err.message);
      } finally {
        mongoose.disconnect();
      }
    });
}

module.exports = createSubscription;
