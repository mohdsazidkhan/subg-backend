const dotenv = require('dotenv');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WalletTransaction = require('../models/WalletTransaction');
const { v4: uuidv4 } = require('uuid');
dotenv.config();
const crypto = require('crypto');
const { sendBrevoEmail } = require('../utils/email');
const mongoose = require('mongoose'); // Added for database connection status check
// ...existing code...

// Health check for debugging
exports.healthCheck = async (req, res) => {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        state: mongoose.connection.readyState,
        states: {
          0: 'disconnected',
          1: 'connected',
          2: 'connecting',
          3: 'disconnecting'
        }
      },
      environment_variables: {
        JWT_SECRET: !!process.env.JWT_SECRET,
        MONGO_URI: !!process.env.MONGO_URI,
        NODE_ENV: process.env.NODE_ENV
      }
    };
    
    res.json({
      success: true,
      message: 'Health check completed',
      data: health
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
};

// Forgot Password: Send reset link
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Generate reset token (JWT or random string)
  const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  await user.save();

  // Send email with reset link using Brevo
  const resetUrl = `https://subgquiz.com/reset-password?token=${resetToken}`;
  const emailSent = await sendBrevoEmail({
    to: user.email,
    subject: 'Password Reset Request',
    html: `
      <div style="max-width:500px;margin:auto;font-family:Arial,sans-serif;background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">
        <div style="background:#f7f7f7;padding:24px 0;text-align:center;">
          <img src="https://subgquiz.com/logo.png" alt="SubgQuiz Logo" style="height:60px;">
        </div>
        <div style="padding:32px 24px 24px 24px;">
          <h2 style="color:#222;margin-bottom:16px;">Password Reset Request</h2>
          <p style="font-size:16px;color:#444;">Hello ${user.name || ''},</p>
          <p style="font-size:16px;color:#444;">You requested a password reset for your SubgQuiz account.</p>
          <p style="margin:24px 0;text-align:center;">
            <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#007bff;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Click here to reset your password</a>
          </p>
          <p style="font-size:14px;color:#888;">This link will expire in 15 minutes.</p>
        </div>
        <div style="background:#f7f7f7;padding:18px 0;text-align:center;">
          <span style="font-size:15px;color:#555;margin-bottom:8px;display:block;">Connect with us:</span>
          <a href="https://x.com/subgquiz" style="margin:0 8px;display:inline-block;" target="_blank"><img src="https://subgquiz.com/x.png" alt="X" style="height:24px;width:24px;"></a>
          <a href="https://youtube.com/@subgquiz" style="margin:0 8px;display:inline-block;" target="_blank"><img src="https://subgquiz.com/youtube.png" alt="YouTube" style="height:24px;width:24px;"></a>
          <a href="https://linkedin.com/company/subgquiz" style="margin:0 8px;display:inline-block;" target="_blank"><img src="https://subgquiz.com/linkedin.png" alt="LinkedIn" style="height:24px;width:24px;"></a>
          <a href="https://instagram.com/subgquiz" style="margin:0 8px;display:inline-block;" target="_blank"><img src="https://subgquiz.com/instagram.png" alt="Instagram" style="height:24px;width:24px;"></a>
          <a href="https://facebook.com/subgquizz" style="margin:0 8px;display:inline-block;" target="_blank"><img src="https://subgquiz.com/facebook.png" alt="Facebook" style="height:24px;width:24px;"></a>
          <div style="margin-top:10px;font-size:13px;color:#aaa;">&copy; ${new Date().getFullYear()} SubgQuiz. All rights reserved.</div>
        </div>
      </div>
    `
  });
  if (!emailSent) {
    return res.status(500).json({ message: 'Failed to send reset email. Please try again later.' });
  }
  res.json({ success: true, message: 'Password reset link sent to your email.' });
};

// Reset Password: Set new password
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password are required' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
  const user = await User.findById(payload.id);
  if (!user || user.resetPasswordToken !== token || Date.now() > user.resetPasswordExpires) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  res.json({ success: true, message: 'Password has been reset successfully.' });
};
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

// Helper: Referral code generate karo
function generateReferralCode() {
  return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}

// Helper: Unique referral code find karo
async function getUniqueReferralCode() {
  let code;
  let exists = true;
  while (exists) {
    code = generateReferralCode();
    exists = await User.exists({ referralCode: code });
  }
  return code;
}

exports.register = async (req, res) => {

  const { name, email, phone, password, role = 'student', referredBy } = req.body;
  
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

    // Unique referralCode generate karo
    const referralCode = await getUniqueReferralCode();

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      subscriptionStatus: 'free',
      referredBy: referredBy || null,
      referralCode
    });

    // Save user first to get the _id
    await user.save();

    // Referral logic
    if (referredBy) {
      // Find referrer by referralCode
      const referrer = await User.findOne({ referralCode: referredBy });
      if (referrer) {
        referrer.referralCount = (referrer.referralCount || 0) + 1;

        // Check for milestones and create subscription if needed
        let milestone = null;
        let plan = null;
        let amount = null;
        if (referrer.referralCount === 10) {
          milestone = 10;
          plan = 'basic';
          amount = 99;
        } else if (referrer.referralCount === 50) {
          milestone = 50;
          plan = 'premium';
          amount = 499;
        } else if (referrer.referralCount === 100) {
          milestone = 100;
          plan = 'pro';
          amount = 999;
        }
        if (milestone && plan && amount) {
          // Create subscription entry for referrer
          const now = new Date();
          const endDate = new Date(now);
          endDate.setFullYear(endDate.getFullYear() + 1); // 1 year validity
          const sub = await Subscription.create({
            user: referrer._id,
            plan,
            status: 'active',
            startDate: now,
            endDate,
            amount,
            currency: 'INR',
            metadata: { referralMilestone: milestone }
          });
          referrer.currentSubscription = sub._id;
          referrer.subscriptionStatus = plan;
          referrer.subscriptionExpiry = endDate;
        }
        await referrer.save();
      }
    }

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
        referralCode: user.referralCode,
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

    // Validation regex
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const phoneRegex = /^\d{10,15}$/;

    // Find user by email or phone
    if (emailRegex.test(identifier)) {
      user = await User.findOne({ email: identifier }).populate('currentSubscription');
    } else if (phoneRegex.test(identifier)) {
      user = await User.findOne({ phone: identifier }).populate('currentSubscription');
    } else {
      return res.status(400).json({ message: 'Please provide a valid email or phone number.' });
    }

    // User not found
    if (!user) {
      return res.status(404).json({ message: 'User Not Found!' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid Credentials' });
    }

    // Generate token with expiry from .env
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' } // fallback to 1d
    );

    // Decode token to get expiry time
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000); // Convert from seconds to ms

    // Get level information
    const levelInfo = user.getLevelInfo();

    // Response
    res.status(200).json({
      success: true,
      message: '🎉 Login Successful!',
      token,
      expiresAt, // Send expiry timestamp to frontend
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

// Google OAuth Authentication
exports.googleAuth = async (req, res) => {
  try {
    console.log('🔍 Google auth request received:', {
      body: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
    
    // Check database connection status
    const dbState = mongoose.connection.readyState;
    console.log('🗄️ Database connection state:', {
      state: dbState,
      states: {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      }[dbState]
    });
    
    if (dbState !== 1) {
      console.error('❌ Database not connected, state:', dbState);
      return res.status(500).json({
        message: 'Database connection error. Please try again later.',
        details: 'Database not connected'
      });
    }
    
    const { googleId, email, name, picture, referralCode } = req.body;
    
    if (!googleId || !email || !name) {
      console.log('❌ Missing required fields:', { googleId: !!googleId, email: !!email, name: !!name });
      return res.status(400).json({ 
        message: 'Google authentication data is incomplete' 
      });
    }

    console.log('✅ Required fields validated, checking user existence...');
    
    // Check if user exists by email
    let user;
    try {
      user = await User.findOne({ email });
      console.log('✅ Database query successful, user found:', !!user);
    } catch (dbError) {
      console.error('❌ Database query error:', dbError);
      throw new Error('Database connection failed');
    }
    
    if (!user) {
      console.log('🆕 Creating new user with Google data...');
      // Create new user with Google data
      let newReferralCode;
      try {
        newReferralCode = await getUniqueReferralCode();
        console.log('✅ Referral code generated:', newReferralCode);
      } catch (refError) {
        console.error('❌ Referral code generation error:', refError);
        // Generate a simple fallback code
        newReferralCode = 'GOOGLE' + Math.random().toString(36).substring(2, 8).toUpperCase();
        console.log('⚠️ Using fallback referral code:', newReferralCode);
      }
      
      // If referral code is provided, validate it
      let referredBy = null;
      if (referralCode) {
        try {
          console.log('🔍 Validating referral code:', referralCode);
          const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
          if (referrer) {
            referredBy = referrer._id;
            console.log('✅ Referral code validated:', referralCode, 'for user:', referrer.email);
            
            // Increment referrer's referral count
            referrer.referralCount = (referrer.referralCount || 0) + 1;
            
            // Check for referral milestones and award badges
            if (referrer.referralCount === 10) {
              if (!referrer.badges.includes('Referral Master')) {
                referrer.badges.push('Referral Master');
                console.log('🏆 Referral Master badge awarded to:', referrer.email);
              }
            } else if (referrer.referralCount === 50) {
              if (!referrer.badges.includes('Referral Legend')) {
                referrer.badges.push('Referral Legend');
                console.log('🏆 Referral Legend badge awarded to:', referrer.email);
              }
            } else if (referrer.referralCount === 100) {
              if (!referrer.badges.includes('Referral God')) {
                referrer.badges.push('Referral God');
                console.log('🏆 Referral God badge awarded to:', referrer.email);
              }
            }
            
            try {
              await referrer.save();
              console.log('✅ Referrer referral count updated:', referrer.referralCount);
            } catch (refSaveError) {
              console.error('❌ Failed to update referrer:', refSaveError);
              // Don't fail the main registration for this
            }
          } else {
            console.log('⚠️ Invalid referral code provided:', referralCode);
            // Don't fail the registration, just log the invalid code
          }
        } catch (refValidationError) {
          console.error('❌ Referral validation error:', refValidationError);
          // Don't fail the registration for referral issues
        }
      }
      
      try {
        user = new User({
          name,
          email,
          googleId,
          profilePicture: picture,
          role: 'student',
          subscriptionStatus: 'free',
          referralCode: newReferralCode,
          referredBy: referredBy,
          // Phone will be null for Google users initially
          phone: null
        });
        console.log('✅ User object created successfully');
      } catch (userCreateError) {
        console.error('❌ User creation error:', userCreateError);
        throw new Error('Failed to create user object');
      }
      
      // Create free subscription for new Google user
      console.log('📦 Creating free subscription for new user...');
      let freeSubscription;
      try {
        freeSubscription = await createFreeSubscription(user._id, false);
        console.log('✅ Free subscription created successfully');
      } catch (subError) {
        console.error('❌ Subscription creation error:', subError);
        throw new Error('Failed to create user subscription');
      }
      
      user.currentSubscription = freeSubscription._id;
      user.subscriptionExpiry = freeSubscription.endDate;
      
      console.log('💾 Saving new user to database...');
      try {
        await user.save();
        console.log('✅ User saved successfully');
      } catch (saveError) {
        console.error('❌ User save error:', saveError);
        throw new Error('Failed to save user data');
      }
      
      console.log('✅ New Google user created:', user.email);
      if (referredBy) {
        console.log('✅ User registered with referral code:', referralCode);
      }
    } else {
      console.log('🔄 Updating existing user with Google data...');
      // Update existing user's Google ID if not set
      if (!user.googleId) {
        try {
          user.googleId = googleId;
          user.profilePicture = picture;
          await user.save();
          console.log('✅ Existing user linked with Google:', user.email);
        } catch (updateError) {
          console.error('❌ Failed to update existing user:', updateError);
          throw new Error('Failed to update user with Google data');
        }
      } else {
        console.log('ℹ️ User already has Google ID, no update needed');
      }
    }
    
    console.log('🔑 Generating JWT token...');
    // Generate JWT token
    let token;
    try {
      token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
      );
      console.log('✅ JWT token generated successfully');
    } catch (jwtError) {
      console.error('❌ JWT token generation error:', jwtError);
      throw new Error('Failed to generate authentication token');
    }
    
    console.log('📊 Getting level information...');
    // Get level information
    let levelInfo;
    try {
      levelInfo = user.getLevelInfo();
      console.log('✅ Level info retrieved successfully');
    } catch (levelError) {
      console.error('❌ Level info retrieval error:', levelError);
      // Don't fail the auth, just set default level info
      levelInfo = {
        currentLevel: { number: 1, name: 'Beginner', description: 'Starting your journey', quizzesRequired: 0 },
        nextLevel: { number: 2, name: 'Novice', description: 'Getting better', quizzesRequired: 5 },
        progress: { quizzesPlayed: 0, highScoreQuizzes: 0, progressPercentage: 0, quizzesToNextLevel: 5, highScoreQuizzesToNextLevel: 5 },
        stats: { totalScore: 0, averageScore: 0, lastLevelUp: null, highScoreRate: 0 }
      };
    }
    
    console.log('🎉 Google auth successful, sending response...');
    res.json({
      success: true,
      message: '🎉 Google login successful!',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profilePicture,
        referralCode: user.referralCode,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry,
        currentSubscription: user.currentSubscription,
        badges: user.badges,
        level: levelInfo
      }
    });
    
  } catch (error) {
    console.error('❌ Google auth error:', error);
    
    // Log more specific error details
    if (error.name === 'ValidationError') {
      console.error('❌ Validation Error:', error.message);
      return res.status(400).json({ 
        message: 'Invalid user data provided',
        details: error.message
      });
    }
    
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      console.error('❌ Database Error:', error.message);
      return res.status(500).json({ 
        message: 'Database connection error. Please try again later.',
        details: error.message
      });
    }
    
    if (error.code === 11000) {
      console.error('❌ Duplicate Key Error:', error.message);
      return res.status(400).json({ 
        message: 'User with this email already exists',
        details: error.message
      });
    }
    
    // Check for missing environment variables
    if (!process.env.JWT_SECRET) {
      console.error('❌ Missing JWT_SECRET environment variable');
      return res.status(500).json({ 
        message: 'Server configuration error. Please contact support.',
        details: 'Missing JWT configuration'
      });
    }
    
    res.status(500).json({ 
      message: 'Google authentication failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || !phone || !email) {
      return res.status(400).json({ 
        message: 'All fields are required: name, phone, email' 
      });
    }

    // Validate phone number format
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({ 
        message: 'Phone number must be exactly 10 digits' 
      });
    }

    // Validate email format
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ 
        message: 'Please provide a valid email address' 
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is already taken by another user
    if (email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ 
          message: 'Email already exists. Please use a different email address.' 
        });
      }
    }

    // Check if phone is already taken by another user
    if (phone !== user.phone) {
      const existingUser = await User.findOne({ phone, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ 
          message: 'Phone number already exists. Please use a different phone number.' 
        });
      }
    }

    // Update user data
    user.name = name;
    user.phone = phone;
    user.email = email;
    
    await user.save();

    // Get updated level information
    const levelInfo = user.getLevelInfo();

    res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profilePicture: user.profilePicture,
        referralCode: user.referralCode,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry,
        currentSubscription: user.currentSubscription,
        badges: user.badges,
        level: levelInfo
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ 
      message: 'Failed to update profile. Please try again later.' 
    });
  }
};

