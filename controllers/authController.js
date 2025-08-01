const dotenv = require('dotenv');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WalletTransaction = require('../models/WalletTransaction');
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
