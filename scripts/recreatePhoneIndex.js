const mongoose = require('mongoose');
require('dotenv').config();

async function recreatePhoneIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Drop the existing phone index
    try {
      await collection.dropIndex('phone_1');
      console.log('✅ Dropped existing phone index');
    } catch (error) {
      console.log('ℹ️ Phone index not found or already dropped');
    }

    // Create a new sparse index on phone field
    await collection.createIndex({ phone: 1 }, { 
      sparse: true,
      unique: false // Remove unique constraint
    });
    console.log('✅ Created new phone index (non-unique, sparse)');

    console.log('🎉 Phone index recreation completed successfully!');
  } catch (error) {
    console.error('❌ Error recreating phone index:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
recreatePhoneIndex();

