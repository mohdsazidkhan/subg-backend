const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const WalletTransaction = require('../models/WalletTransaction');

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Function to create free subscription for admin
const createAdminSubscription = async (userId) => {
  try {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(2099); // Lifetime subscription for admin

    const subscription = await Subscription.create({
      user: userId,
      plan: 'free',
      status: 'active',
      startDate,
      endDate,
      amount: 0,
      currency: 'INR',
      features: {
        unlimitedQuizzes: true,
        liveQuizzes: true,
        prioritySupport: true,
        advancedAnalytics: true,
        customBadges: true,
        exclusiveBadges: true,
        bonusContent: true,
        communityAccess: true,
        basicAnalytics: true,
        emailSupport: true
      }
    });

    return subscription;
  } catch (error) {
    console.error('Error creating admin subscription:', error);
    throw error;
  }
};

// Function to validate admin data
const validateAdminData = (adminData) => {
  const errors = [];

  if (!adminData.name || adminData.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }

  if (!adminData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminData.email)) {
    errors.push('Valid email is required');
  }

  if (!adminData.phone || !/^[0-9]{10}$/.test(adminData.phone)) {
    errors.push('Phone number must be 10 digits');
  }

  if (!adminData.password || adminData.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  return errors;
};

// Function to create admin user
const createAdmin = async (adminData) => {
  try {
    console.log('🔍 Validating admin data...');
    const validationErrors = validateAdminData(adminData);
    
    if (validationErrors.length > 0) {
      console.error('❌ Validation errors:');
      validationErrors.forEach(error => console.error(`   - ${error}`));
      return { success: false, errors: validationErrors };
    }

    console.log('🔍 Checking for existing users...');
    
    // Check if email already exists
    const existingUserByEmail = await User.findOne({ email: adminData.email });
    if (existingUserByEmail) {
      return { 
        success: false, 
        errors: ['Email already exists. Please use a different email address.'] 
      };
    }

    // Check if phone already exists
    const existingUserByPhone = await User.findOne({ phone: adminData.phone });
    if (existingUserByPhone) {
      return { 
        success: false, 
        errors: ['Phone number already exists. Please use a different phone number.'] 
      };
    }

    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(adminData.password, 12);

    console.log('👤 Creating admin user...');
    const admin = new User({
      name: adminData.name.trim(),
      email: adminData.email.toLowerCase().trim(),
      phone: adminData.phone.trim(),
      password: hashedPassword,
      role: 'admin',
      badges: ['Admin', 'System Administrator', 'Legend Badge'],
      level: {
        currentLevel: 10,
        levelName: 'Legend',
        quizzesPlayed: 0,
        highScoreQuizzes: 0,
        totalScore: 0,
        averageScore: 0,
        levelProgress: 100,
        lastLevelUp: new Date()
      },
      subscriptionStatus: 'free'
    });

    // Save admin user first to get the _id
    await admin.save();
    console.log('✅ Admin user saved');

    console.log('📦 Creating admin subscription...');
    const adminSubscription = await createAdminSubscription(admin._id);
    
    // Update admin with subscription details
    admin.currentSubscription = adminSubscription._id;
    admin.subscriptionExpiry = adminSubscription.endDate;
    await admin.save();
    console.log('✅ Admin subscription linked');

    console.log('💰 Creating wallet transaction...');
    await WalletTransaction.create({
      user: admin._id,
      type: 'credit',
      amount: 0,
      balance: 0,
      category: 'subscription_payment',
      description: 'Admin lifetime subscription - All levels (0-10) access'
    });
    console.log('✅ Wallet transaction recorded');

    // Get level information for admin
    const levelInfo = admin.getLevelInfo();

    console.log('🎉 Admin created successfully!');
    
    return {
      success: true,
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        subscriptionStatus: admin.subscriptionStatus,
        subscriptionExpiry: admin.subscriptionExpiry,
        currentSubscription: adminSubscription,
        badges: admin.badges,
        level: levelInfo,
        createdAt: admin.createdAt
      }
    };

  } catch (error) {
    console.error('❌ Error creating admin:', error);
    
    // Handle specific database errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return { 
        success: false, 
        errors: [`${field.charAt(0).toUpperCase() + field.slice(1)} already exists. Please use a different ${field}.`] 
      };
    }
    
    return { 
      success: false, 
      errors: ['Failed to create admin. Please try again later.', error.message] 
    };
  }
};

// Function to create admin interactively
const createAdminInteractive = async () => {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  try {
    console.log('🚀 Admin Creation Tool');
    console.log('=====================\n');

    const adminData = {};

    adminData.name = await question('Enter admin name: ');
    adminData.email = await question('Enter admin email: ');
    adminData.phone = await question('Enter admin phone (10 digits): ');
    adminData.password = await question('Enter admin password (min 6 characters): ');

    rl.close();

    console.log('\n🔍 Creating admin...');
    const result = await createAdmin(adminData);

    if (result.success) {
      console.log('\n✅ Admin created successfully!');
      console.log('📋 Admin Details:');
      console.log(`   Name: ${result.admin.name}`);
      console.log(`   Email: ${result.admin.email}`);
      console.log(`   Phone: ${result.admin.phone}`);
      console.log(`   Role: ${result.admin.role}`);
      console.log(`   Subscription: ${result.admin.subscriptionStatus} (Lifetime)`);
      console.log(`   Level: ${result.admin.level.currentLevel.name} (Level ${result.admin.level.currentLevel.number})`);
      console.log(`   Badges: ${result.admin.badges.join(', ')}`);
      console.log(`   Created: ${result.admin.createdAt}`);
      console.log('\n🎉 Admin can now login with their email and password!');
    } else {
      console.log('\n❌ Failed to create admin:');
      result.errors.forEach(error => console.error(`   - ${error}`));
    }

  } catch (error) {
    console.error('❌ Error in interactive mode:', error);
  }
};

// Function to create admin with provided data
const createAdminWithData = async (adminData) => {
  console.log('🔍 Creating admin with provided data...');
  const result = await createAdmin(adminData);

  if (result.success) {
    console.log('\n✅ Admin created successfully!');
    console.log('📋 Admin Details:');
    console.log(`   Name: ${result.admin.name}`);
    console.log(`   Email: ${result.admin.email}`);
    console.log(`   Phone: ${result.admin.phone}`);
    console.log(`   Role: ${result.admin.role}`);
    console.log(`   Subscription: ${result.admin.subscriptionStatus} (Lifetime)`);
    console.log(`   Level: ${result.admin.level.currentLevel.name} (Level ${result.admin.level.currentLevel.number})`);
    console.log(`   Badges: ${result.admin.badges.join(', ')}`);
    console.log(`   Created: ${result.admin.createdAt}`);
    console.log('\n🎉 Admin can now login with their email and password!');
  } else {
    console.log('\n❌ Failed to create admin:');
    result.errors.forEach(error => console.error(`   - ${error}`));
  }

  return result;
};

// Function to list all admins
const listAdmins = async () => {
  try {
    const admins = await User.find({ role: 'admin' })
      .select('name email phone subscriptionStatus createdAt')
      .sort({ createdAt: -1 });

    console.log('\n👥 Admin Users:');
    console.log('================');
    
    if (admins.length === 0) {
      console.log('No admin users found.');
    } else {
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.name}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   Phone: ${admin.phone}`);
        console.log(`   Subscription: ${admin.subscriptionStatus}`);
        console.log(`   Created: ${admin.createdAt.toLocaleDateString()}`);
        console.log('');
      });
    }

    return admins;
  } catch (error) {
    console.error('❌ Error listing admins:', error);
    return [];
  }
};

// Main execution
const main = async () => {
  await connectDB();

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'interactive':
      await createAdminInteractive();
      break;
    
    case 'create':
      if (args.length < 5) {
        console.log('Usage: node createAdmin.js create <name> <email> <phone> <password>');
        process.exit(1);
      }
      const adminData = {
        name: args[1],
        email: args[2],
        phone: args[3],
        password: args[4]
      };
      await createAdminWithData(adminData);
      break;
    
    case 'list':
      await listAdmins();
      break;
    
    default:
      console.log('🚀 Admin Creation Tool');
      console.log('=====================\n');
      console.log('Usage:');
      console.log('  node createAdmin.js interactive                    - Create admin interactively');
      console.log('  node createAdmin.js create <name> <email> <phone> <password>  - Create admin with data');
      console.log('  node createAdmin.js list                          - List all admins');
      console.log('\nExample:');
      console.log('  node createAdmin.js create "John Admin" "admin@example.com" "1234567890" "password123"');
  }

  await mongoose.connection.close();
  console.log('\n👋 Disconnected from MongoDB');
};

// Export functions for use in other files
module.exports = {
  createAdmin,
  createAdminInteractive,
  createAdminWithData,
  listAdmins,
  validateAdminData
};

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
} 