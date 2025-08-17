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
// ...existing code...

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
    const { googleId, email, name, picture, referralCode } = req.body;
    
    if (!googleId || !email || !name) {
      return res.status(400).json({ 
        message: 'Google authentication data is incomplete' 
      });
    }

    // Check if user exists by email
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user with Google data
      const newReferralCode = await getUniqueReferralCode();
      
      // If referral code is provided, validate it
      let referredBy = null;
      if (referralCode) {
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
          
          await referrer.save();
          console.log('✅ Referrer referral count updated:', referrer.referralCount);
        } else {
          console.log('⚠️ Invalid referral code provided:', referralCode);
          // Don't fail the registration, just log the invalid code
        }
      }
      
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
      
      // Create free subscription for new Google user
      const freeSubscription = await createFreeSubscription(user._id, false);
      user.currentSubscription = freeSubscription._id;
      user.subscriptionExpiry = freeSubscription.endDate;
      
      await user.save();
      
      console.log('✅ New Google user created:', user.email);
      if (referredBy) {
        console.log('✅ User registered with referral code:', referralCode);
      }
    } else {
      // Update existing user's Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.profilePicture = picture;
        await user.save();
        console.log('✅ Existing user linked with Google:', user.email);
      }
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
    
    // Get level information
    const levelInfo = user.getLevelInfo();
    
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
    res.status(500).json({ 
      message: 'Google authentication failed. Please try again.' 
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

