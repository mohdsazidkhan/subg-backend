const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function fixPhoneField() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all users with phone: null
    const usersWithNullPhone = await User.find({ phone: null });
    console.log(`📱 Found ${usersWithNullPhone.length} users with phone: null`);

    if (usersWithNullPhone.length > 0) {
      // Update all users with phone: null to phone: undefined
      const result = await User.updateMany(
        { phone: null },
        { $unset: { phone: 1 } }
      );
      console.log(`✅ Updated ${result.modifiedCount} users`);
    }

    // Also find users with phone: "" (empty string) and remove it
    const usersWithEmptyPhone = await User.find({ phone: "" });
    console.log(`📱 Found ${usersWithEmptyPhone.length} users with phone: ""`);

    if (usersWithEmptyPhone.length > 0) {
      const result = await User.updateMany(
        { phone: "" },
        { $unset: { phone: 1 } }
      );
      console.log(`✅ Updated ${result.modifiedCount} users with empty phone`);
    }

    console.log('🎉 Phone field cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Error fixing phone field:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
fixPhoneField();

