const dotenv = require('dotenv');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WalletTransaction = require('../models/WalletTransaction');
dotenv.config();

// Function to create free subscription for new users
const createFreeSubscription = async (userId, isAdmin = false) => {
  try {
    const startDate = new Date();
    let endDate = new Date();
    
    if (isAdmin) {
      // Admin gets lifetime subscription (expires in 2099)
      endDate.setFullYear(2099);
    } else {
      // Regular users get 1 year free subscription
      endDate.setDate(endDate.getDate() + 365);
    }

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
        liveQuizzes: false,
        prioritySupport: false,
        advancedAnalytics: false,
        customBadges: false
      }
    });

    return subscription;
  } catch (error) {
    console.error('Error creating free subscription:', error);
    throw error;
  }
};

exports.register = async (req, res) => {
  const { name, email, phone, password, role = 'student' } = req.body;
  
  try {
    // Additional validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ 
        message: 'All fields are required: name, email, phone, password' 
      });
    }

    // Check if email already exists
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return res.status(400).json({ 
        message: 'Email already exists. Please use a different email address.' 
      });
    }

    // Check if phone already exists
    const existingUserByPhone = await User.findOne({ phone });
    if (existingUserByPhone) {
      return res.status(400).json({ 
        message: 'Phone number already exists. Please use a different phone number.' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      subscriptionStatus: 'free'
    });

    // Save user first to get the _id
    await user.save();

    // Create free subscription for new user (1 year for regular users, lifetime for admin)
    const isAdmin = role === 'admin';
    const freeSubscription = await createFreeSubscription(user._id, isAdmin);
    
    // Update user with subscription details
    user.currentSubscription = freeSubscription._id;
    user.subscriptionExpiry = freeSubscription.endDate;
    await user.save();

    // Record signup in wallet transaction
    const subscriptionDuration = isAdmin ? 'lifetime' : '1 year';
    const levelAccess = isAdmin ? 'all levels (0-10)' : 'levels 0-3';
    await WalletTransaction.create({
      user: user._id,
      type: 'credit',
      amount: 0,
      balance: 0,
      category: 'subscription_payment',
      description: `Free ${subscriptionDuration} subscription - ${levelAccess} access`
    });

    // Get level information for new user
    const levelInfo = user.getLevelInfo();

    const successMessage = isAdmin 
      ? '🎉 Admin Registered Successfully! You have lifetime free access to all levels (0-10)!'
      : '🎉 Registered Successfully! You have 1 year free access to levels 0-3!';

    res.status(201).json({
      success: true,
      message: successMessage,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry,
        currentSubscription: freeSubscription,
        badges: user.badges,
        level: levelInfo
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    
    // Handle specific database errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists. Please use a different ${field}.` 
      });
    }
    
    res.status(500).json({ 
      message: 'Registration failed. Please try again later.' 
    });
  }
};

exports.login = async (req, res) => {
  const { identifier, password } = req.body;
  try {
    let user;
    // Check if identifier is an email
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const phoneRegex = /^\d{10,15}$/;
    if (emailRegex.test(identifier)) {
      user = await User.findOne({ email: identifier }).populate('currentSubscription');
    } else if (phoneRegex.test(identifier)) {
      user = await User.findOne({ phone: identifier }).populate('currentSubscription');
    } else {
      return res.status(400).json({ message: 'Please provide a valid email or phone number.' });
    }
    if (!user) return res.status(404).json({ message: 'User Not Found!' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid Credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    // Get level information
    const levelInfo = user.getLevelInfo();

    res.status(200).json({
      success: true,
      message: '🎉 Login Successful!',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry,
        currentSubscription: user.currentSubscription,
        badges: user.badges,
        level: levelInfo
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message });
  }
};
