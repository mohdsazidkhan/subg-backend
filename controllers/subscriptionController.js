const User = require('../models/User');
const Subscription = require('../models/Subscription');
const WalletTransaction = require('../models/WalletTransaction');

// Get user's current subscription
exports.getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('currentSubscription');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry,
        currentSubscription: user.currentSubscription
      }
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription',
      error: error.message
    });
  }
};

// Get all subscription plans
exports.getSubscriptionPlans = async (req, res) => {
  try {
    const plans = [
      {
        id: 'free',
        name: 'Free Plan',
        price: 0,
        duration: 0, // permanent
        features: {
          unlimitedQuizzes: true,
          liveQuizzes: false,
          prioritySupport: false,
          advancedAnalytics: false,
          customBadges: false,
          exclusiveBadges: false,
          bonusContent: false,
          communityAccess: true,
          basicAnalytics: true,
          emailSupport: true
        },
        description: 'Basic access to quizzes and features (Admin: All levels 0-10)',
        levelAccess: 'Levels 0-3 (Admin: All levels)'
      },
      {
        id: 'basic',
        name: 'Basic Plan',
        price: 99,
        duration: 365, // days
        features: {
          unlimitedQuizzes: true,
          liveQuizzes: false,
          prioritySupport: false,
          advancedAnalytics: true,
          customBadges: false,
          exclusiveBadges: false,
          bonusContent: false,
          communityAccess: true,
          basicAnalytics: true,
          emailSupport: true
        },
        description: 'Access to unlimited quizzes with detailed analytics and community features',
        levelAccess: 'Levels 0-6'
      },
      {
        id: 'premium',
        name: 'Premium Plan',
        price: 499,
        duration: 365, // days
        features: {
          unlimitedQuizzes: true,
          liveQuizzes: true,
          prioritySupport: true,
          advancedAnalytics: true,
          customBadges: false,
          exclusiveBadges: true,
          bonusContent: true,
          communityAccess: true,
          basicAnalytics: true,
          emailSupport: true
        },
        description: 'Access to unlimited quizzes, advanced analytics, exclusive badges, and priority support',
        levelAccess: 'Levels 0-9'
      },
      {
        id: 'pro',
        name: 'Pro Plan',
        price: 999,
        duration: 365, // days
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
        },
        description: 'Complete access to all features including custom categories, data export, and API access',
        levelAccess: 'All Levels (0-10)'
      }
    ];

    res.status(200).json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription plans',
      error: error.message
    });
  }
};

// Create subscription order
exports.createSubscriptionOrder = async (req, res) => {
  try {
    const { planId, userId } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const plans = {
      free: { price: 0, duration: 0 },
      basic: { price: 99, duration: 365 },
      premium: { price: 499, duration: 365 },
      pro: { price: 999, duration: 365 }
    };

    const selectedPlan = plans[planId];
    if (!selectedPlan) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }

    const startDate = new Date();
    const endDate = new Date();
    if (selectedPlan.duration > 0) {
      endDate.setDate(endDate.getDate() + selectedPlan.duration);
    } else {
      // For free plan, check user role
      if (user.role === 'admin') {
        // Admin gets lifetime subscription (expires in 2099)
        endDate.setFullYear(2099);
      } else {
        // Regular users get 1 year free subscription
        endDate.setDate(endDate.getDate() + 365);
      }
    }

    // Create subscription record
    const subscription = new Subscription({
      user: user._id,
      plan: planId,
      status: 'active',
      startDate: startDate,
      endDate: endDate,
      amount: selectedPlan.price,
      currency: 'INR',
      features: {
        unlimitedQuizzes: false,
        detailedAnalytics: false,
        prioritySupport: false,
        customCategories: false,
        advancedReports: false,
        exportData: false,
        apiAccess: false,
        whiteLabel: false
      }
    });

    await subscription.save();

    res.status(200).json({
      success: true,
      data: {
        subscriptionId: subscription._id,
        amount: selectedPlan.price,
        plan: planId,
        duration: user.role === 'admin' && planId === 'free' ? 'lifetime' : selectedPlan.duration
      }
    });
  } catch (error) {
    console.error('Error creating subscription order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription order',
      error: error.message
    });
  }
};

// Activate subscription after payment
exports.activateSubscription = async (req, res) => {
  try {
    const { subscriptionId, orderId } = req.body;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    // Update subscription status
    subscription.status = 'active';
    await subscription.save();

    // Update user subscription
    const user = await User.findById(subscription.user);
    user.currentSubscription = subscription._id;
    user.subscriptionStatus = subscription.plan;
    user.subscriptionExpiry = subscription.endDate;
    await user.save();

    // Log transaction
    await WalletTransaction.create({
      user: subscription.user,
      type: 'debit',
      amount: subscription.amount,
      balance: 0,
      description: `${subscription.plan} subscription activated for ${subscription.amount} INR`,
      category: 'subscription_payment'
    });

    res.status(200).json({
      success: true,
      message: 'Subscription activated successfully',
      data: {
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry
      }
    });
  } catch (error) {
    console.error('Error activating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate subscription',
      error: error.message
    });
  }
};

// Check if user has access to feature
exports.checkFeatureAccess = async (req, res) => {
  try {
    const { feature, userId } = req.params;
    
    const user = await User.findById(userId).populate('currentSubscription');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if subscription is active
    if (!user.currentSubscription || user.currentSubscription.status !== 'active') {
      return res.status(403).json({ 
        success: false, 
        hasAccess: false,
        message: 'No active subscription found' 
      });
    }

    // Check if subscription has expired
    if (user.subscriptionExpiry && new Date() > user.subscriptionExpiry) {
      return res.status(403).json({ 
        success: false, 
        hasAccess: false,
        message: 'Subscription has expired' 
      });
    }

    // Check feature access based on plan
    const featureAccess = {
      unlimitedQuizzes: ['basic', 'premium', 'pro'].includes(user.subscriptionStatus),
      liveQuizzes: ['premium', 'pro'].includes(user.subscriptionStatus),
      prioritySupport: ['premium', 'pro'].includes(user.subscriptionStatus),
      advancedAnalytics: ['pro'].includes(user.subscriptionStatus),
      customBadges: ['pro'].includes(user.subscriptionStatus)
    };

    const hasAccess = featureAccess[feature] || false;

    res.status(200).json({
      success: true,
      hasAccess,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiry: user.subscriptionExpiry
    });
  } catch (error) {
    console.error('Error checking feature access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check feature access',
      error: error.message
    });
  }
};

// Get user's subscription history
exports.getSubscriptionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const subscriptions = await Subscription.find({ user: userId })
      .sort({ createdAt: -1 })
      .exec();

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
    });
  } catch (error) {
    console.error('Error fetching subscription history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription history',
      error: error.message
    });
  }
}; 