/**
 * Check if user has access to a specific feature based on their subscription
 * @param {Object} user - User object with subscription details
 * @param {string} feature - Feature to check access for
 * @returns {Object} - Access result with hasAccess boolean and message
 */
function checkFeatureAccess(user, feature) {
  // Check if user has active subscription
  if (!user.currentSubscription || user.currentSubscription.status !== 'active') {
    return {
      hasAccess: false,
      message: 'No active subscription found',
      requiresSubscription: true
    };
  }

  // Check if subscription has expired
  if (user.subscriptionExpiry && new Date() > user.subscriptionExpiry) {
    return {
      hasAccess: false,
      message: 'Subscription has expired',
      requiresRenewal: true
    };
  }

  // Define feature access based on subscription plans
  const featureAccess = {
    unlimitedQuizzes: ['basic', 'premium', 'pro'],
    liveQuizzes: ['premium', 'pro'],
    prioritySupport: ['premium', 'pro'],
    advancedAnalytics: ['pro'],
    customBadges: ['pro']
  };

  const hasAccess = featureAccess[feature]?.includes(user.subscriptionStatus) || false;

  if (!hasAccess) {
    const requiredPlan = getRequiredPlanForFeature(feature);
    return {
      hasAccess: false,
      message: `${requiredPlan} subscription required for this feature`,
      requiresUpgrade: true,
      requiredPlan
    };
  }

  return {
    hasAccess: true,
    message: 'Access granted',
    subscriptionStatus: user.subscriptionStatus
  };
}

/**
 * Get the minimum required plan for a specific feature
 * @param {string} feature - Feature name
 * @returns {string} - Required plan name
 */
function getRequiredPlanForFeature(feature) {
  const planRequirements = {
    unlimitedQuizzes: 'Basic',
    liveQuizzes: 'Premium',
    prioritySupport: 'Premium',
    advancedAnalytics: 'Pro',
    customBadges: 'Pro'
  };

  return planRequirements[feature] || 'Basic';
}

/**
 * Get subscription plan details
 * @param {string} planId - Plan identifier
 * @returns {Object} - Plan details
 */
function getPlanDetails(planId) {
  const plans = {
    free: {
      id: 'free',
      name: 'Free Plan',
      price: 0,
      duration: 365, // 1 year for regular users, lifetime for admin
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
      description: 'Basic access to quizzes and features (levels 0-3)'
    },
    basic: {
      id: 'basic',
      name: 'Basic Plan',
      price: 99,
      duration: 365,
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
      description: 'Access to unlimited quizzes with basic analytics and community features (levels 0-6)'
    },
    premium: {
      id: 'premium',
      name: 'Premium Plan',
      price: 499,
      duration: 365,
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
      description: 'Access to unlimited quizzes, advanced analytics, exclusive badges, and priority support (levels 0-9)'
    },
    pro: {
      id: 'pro',
      name: 'Pro Plan',
      price: 999,
      duration: 365,
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
      description: 'Complete access to all features including custom categories, data export, and API access (all levels 0-10)'
    }
  };

  return plans[planId] || null;
}

/**
 * Calculate subscription expiry date
 * @param {number} duration - Duration in days
 * @returns {Date} - Expiry date
 */
function calculateExpiryDate(duration = 365) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + duration);
  return expiryDate;
}

/**
 * Check if subscription is about to expire (within 7 days)
 * @param {Date} expiryDate - Subscription expiry date
 * @returns {boolean} - True if expiring soon
 */
function isExpiringSoon(expiryDate) {
  if (!expiryDate) return false;
  
  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  
  return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
}

const subscriptionPlans = {
  free: {
    name: 'Free',
    price: 0,
    duration: 'lifetime', // For admin users (expires 2099), regular users get 1 year
    features: {
      unlimitedQuizzes: true,
      detailedAnalytics: false,
      prioritySupport: false,
      customCategories: false,
      advancedReports: false,
      exportData: false,
      apiAccess: false,
      whiteLabel: false,
      liveQuizzes: false,
      exclusiveBadges: false,
      bonusContent: false,
      communityAccess: true,
      basicAnalytics: true,
      emailSupport: true
    },
    description: 'Basic access to quizzes and features (1 year for users with levels 0-3, lifetime until 2099 for admin with all levels)'
  },
  basic: {
    name: 'Basic',
    price: 99,
    duration: 'year',
    features: {
      unlimitedQuizzes: true,
      detailedAnalytics: true,
      prioritySupport: false,
      customCategories: false,
      advancedReports: false,
      exportData: false,
      apiAccess: false,
      whiteLabel: false,
      liveQuizzes: false,
      exclusiveBadges: false,
      bonusContent: false,
      communityAccess: true,
      basicAnalytics: true,
      emailSupport: true
    },
    description: 'Access to unlimited quizzes with basic analytics and community features'
  },
  premium: {
    name: 'Premium',
    price: 499,
    duration: 'year',
    features: {
      unlimitedQuizzes: true,
      detailedAnalytics: true,
      prioritySupport: true,
      customCategories: false,
      advancedReports: true,
      exportData: false,
      apiAccess: false,
      whiteLabel: false,
      liveQuizzes: true,
      exclusiveBadges: true,
      bonusContent: true,
      communityAccess: true,
      basicAnalytics: true,
      emailSupport: true
    },
    description: 'Access to unlimited quizzes, advanced analytics, exclusive badges, and priority support'
  },
  pro: {
    name: 'Pro',
    price: 999,
    duration: 'year',
    features: {
      unlimitedQuizzes: true,
      detailedAnalytics: true,
      prioritySupport: true,
      customCategories: true,
      advancedReports: true,
      exportData: true,
      apiAccess: true,
      whiteLabel: false,
      liveQuizzes: true,
      exclusiveBadges: true,
      bonusContent: true,
      communityAccess: true,
      basicAnalytics: true,
      emailSupport: true
    },
    description: 'Complete access to all features including custom categories, data export, and API access'
  }
};

const getSubscriptionFeatures = (plan) => {
  return subscriptionPlans[plan]?.features || subscriptionPlans.free.features;
};

const hasFeature = (user, feature) => {
  if (!user || !user.subscriptionStatus) return false;
  
  const plan = user.subscriptionStatus;
  const features = getSubscriptionFeatures(plan);
  
  return features[feature] || false;
};

const canAccessQuiz = (user, quiz) => {
  if (!user || !quiz) return false;
  
  // Free users can access basic quizzes
  if (user.subscriptionStatus === 'free') {
    return quiz.difficulty === 'easy' || quiz.difficulty === 'medium';
  }
  
  // All other subscription levels can access all quizzes
  return true;
};

const getSubscriptionStatusText = (status) => {
  const statusMap = {
    'free': 'Free Plan',
    'basic': 'Basic Plan',
    'premium': 'Premium Plan',
    'pro': 'Pro Plan'
  };
  
  return statusMap[status] || 'Free Plan';
};

module.exports = {
  checkFeatureAccess,
  getRequiredPlanForFeature,
  getPlanDetails,
  calculateExpiryDate,
  isExpiringSoon,
  subscriptionPlans,
  getSubscriptionFeatures,
  hasFeature,
  canAccessQuiz,
  getSubscriptionStatusText
}; 