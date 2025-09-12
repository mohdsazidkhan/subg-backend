const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: { type: String, required: false }, // Removed unique constraint for Google users
  password: { type: String },
  role: { type: String, enum: ['admin', 'student'], default: 'student' },
  badges: { type: [String], default: ['Student'] },
  
  // Google OAuth fields
  googleId: { type: String, sparse: true }, // Google OAuth ID
  profilePicture: { type: String }, // Profile picture URL from Google
  
  // Social media links (optional)
  socialLinks: {
    instagram: { type: String, default: null },
    facebook: { type: String, default: null },
    x: { type: String, default: null }, // Twitter/X
    youtube: { type: String, default: null }
  },
  
  // Referral system fields
  referralCode: { type: String, unique: true, default: () => uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase() },
  referredBy: { type: String, default: null }, // referralCode of the referrer
  referralCount: { type: Number, default: 0 },
  
  // User Level System
  level: {
    currentLevel: { type: Number, default: 0 },
    levelName: { type: String, default: 'Starter' },
    quizzesPlayed: { type: Number, default: 0 },
    highScoreQuizzes: { type: Number, default: 0 }, // Quizzes with score >= 75%
    totalScore: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    levelProgress: { type: Number, default: 0 }, // Percentage to next level
    lastLevelUp: { type: Date, default: Date.now }
  },
  

  
  // Track best scores for each quiz (single attempt system)
  quizBestScores: [{
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    bestScore: { type: Number, default: 0 },
    bestScorePercentage: { type: Number, default: 0 },
    isHighScore: { type: Boolean, default: false }, // Whether best score >= 75%
    lastAttemptDate: { type: Date, default: Date.now }
  }],
  
  // Subscription related fields
  currentSubscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  subscriptionStatus: { 
    type: String, 
    enum: ['free', 'basic', 'premium', 'pro'], 
    default: 'free' 
  },
  subscriptionExpiry: { type: Date },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  
  // Monthly progress tracking (resets every month)
  monthlyProgress: {
    month: { type: String, default: () => new Date().toISOString().slice(0, 7) }, // YYYY-MM
    highScoreWins: { type: Number, default: 0 },
    totalQuizAttempts: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 }, // (wins / attempts) * 100
    currentLevel: { type: Number, default: 0 },
    rewardEligible: { type: Boolean, default: false },
    rewardRank: { type: Number, default: null },

  },
  
  // Monthly rewards tracking
  claimableRewards: {
    type: Number,
    default: 0
  },
  
  // Profile completion tracking
  profileCompleted: { type: Boolean, default: false },
  profileCompletionReward: { type: Boolean, default: false } // Track if user got reward for profile completion
  
}, { timestamps: true });

// Level configuration (monthly cumulative wins)
userSchema.statics.LEVEL_CONFIG = {
  0: { name: 'Starter', quizzesRequired: 0, description: 'Just registered - Start your journey!' },
  1: { name: 'Rookie', quizzesRequired: 2, description: 'Just getting started – Easy questions' },
  2: { name: 'Explorer', quizzesRequired: 6, description: 'Discover new ideas – Slightly challenging' },
  3: { name: 'Thinker', quizzesRequired: 12, description: 'Test your brain power – Moderate difficulty' },
  4: { name: 'Strategist', quizzesRequired: 20, description: 'Mix of logic, memory, and speed' },
  5: { name: 'Achiever', quizzesRequired: 30, description: 'Cross-topic challenges begin' },
  6: { name: 'Mastermind', quizzesRequired: 42, description: 'For those who always aim to win' },
  7: { name: 'Champion', quizzesRequired: 56, description: 'Beat the timer and the brain' },
  8: { name: 'Prodigy', quizzesRequired: 72, description: 'Only a few reach here – high-level puzzles' },
  9: { name: 'Wizard', quizzesRequired: 90, description: 'Complex questions across categories' },
  10: { name: 'Legend', quizzesRequired: 110, description: 'Final frontier — only the best reach here!' }
};

// Method to calculate and update user level
// Update monthly level + global level fields for compatibility
userSchema.methods.updateLevel = function() {
  const config = this.constructor.LEVEL_CONFIG;
  
  // Ensure monthlyProgress is for current month
  this.ensureMonthlyProgress();

  // Use monthly high-score wins for level calculation
  const monthlyWins = Number(this.monthlyProgress.highScoreWins) || 0;
  
  let newLevel = this.level.currentLevel;
  let newLevelName = this.level.levelName;
  
  // Find level by current month's wins
  for (let level = 10; level >= 0; level--) {
    if (monthlyWins >= config[level].quizzesRequired) {
      newLevel = level;
      newLevelName = config[level].name;
      break;
    }
  }
  
  // Check if level increased
  const levelIncreased = newLevel > this.level.currentLevel;
  
  // Update level
  this.level.currentLevel = newLevel;
  this.level.levelName = newLevelName;
  
  // Calculate progress to next level based on monthly wins
  const currentLevelQuizzes = config[newLevel].quizzesRequired;
  const nextLevelQuizzes = config[Math.min(newLevel + 1, 10)].quizzesRequired;
  
  // Handle edge cases for progress calculation
  if (newLevel >= 10) {
    // User is at maximum level
    this.level.levelProgress = 100;
  } else if (currentLevelQuizzes === 0) {
    // Level 0 case - no quizzes required for current level
    this.level.levelProgress = 0;
  } else if (nextLevelQuizzes === currentLevelQuizzes) {
    // Prevent division by zero
    this.level.levelProgress = 0;
  } else {
    const span = Math.max(1, nextLevelQuizzes - currentLevelQuizzes);
    const withinLevel = Math.max(0, monthlyWins - currentLevelQuizzes);
    const progress = Math.min(100, Math.round((withinLevel / span) * 100));
    this.level.levelProgress = Math.max(0, isNaN(progress) ? 0 : progress);
  }
  
  if (levelIncreased) {
    this.level.lastLevelUp = new Date();
  }
  
  // Sync monthly currentLevel
  this.monthlyProgress.currentLevel = newLevel;

  // Determine monthly eligibility
  const accuracy = Number(this.monthlyProgress.accuracy) || 0;
  const eligible = monthlyWins >= 110 && accuracy >= 75 && newLevel === 10;
  this.monthlyProgress.rewardEligible = eligible;
  
  return { levelIncreased, newLevel, newLevelName };
};

// Ensure monthly progress exists and is for the current month; reset if month changed
userSchema.methods.ensureMonthlyProgress = function() {
  const getMonthString = () => new Date().toISOString().slice(0, 7);
  const currentMonth = getMonthString();
  if (!this.monthlyProgress) {
    this.monthlyProgress = {
      month: currentMonth,
      highScoreWins: 0,
      totalQuizAttempts: 0,
      accuracy: 0,
      currentLevel: 0,
      rewardEligible: false,
      rewardRank: null,
      rewardLocked: false
    };
    return;
  }
  if (this.monthlyProgress.month !== currentMonth) {
    this.monthlyProgress.month = currentMonth;
    this.monthlyProgress.highScoreWins = 0;
    this.monthlyProgress.totalQuizAttempts = 0;
    this.monthlyProgress.accuracy = 0;
    this.monthlyProgress.currentLevel = 0;
    this.monthlyProgress.rewardEligible = false;
    this.monthlyProgress.rewardRank = null;
    this.monthlyProgress.rewardLocked = false;
  }
};

// Method to add quiz completion
userSchema.methods.addQuizCompletion = function(score, totalQuestions) {
  // Update global level stats for compatibility
  this.level.quizzesPlayed += 1;
  this.level.totalScore += score;
  this.level.averageScore = Math.round(this.level.totalScore / this.level.quizzesPlayed) || 0;
  
  // Calculate score percentage
  const scorePercentage = (score / totalQuestions) * 100;
  
  // Monthly tracking
  this.monthlyProgress.totalQuizAttempts += 1;
  if (scorePercentage >= 75) {
    this.monthlyProgress.highScoreWins += 1;
  }
  this.monthlyProgress.accuracy = this.monthlyProgress.totalQuizAttempts > 0
    ? Math.round((this.monthlyProgress.highScoreWins / this.monthlyProgress.totalQuizAttempts) * 100)
    : 0;
  
  const levelUpdate = this.updateLevel();
  
  return {
    ...levelUpdate,
    scorePercentage: Math.round(scorePercentage),
    isHighScore: scorePercentage >= 75,
    monthly: {
      highScoreWins: this.monthlyProgress.highScoreWins,
      totalQuizAttempts: this.monthlyProgress.totalQuizAttempts,
      accuracy: this.monthlyProgress.accuracy,
      currentLevel: this.monthlyProgress.currentLevel,
      rewardEligible: this.monthlyProgress.rewardEligible
    }
  };
};

// Method to get level info
userSchema.methods.getLevelInfo = function() {
  try {
    const config = this.constructor.LEVEL_CONFIG;
    const currentLevel = this.level?.currentLevel || 0;
    const nextLevel = Math.min(currentLevel + 1, 10);
    
    // Ensure level object exists
    if (!this.level) {
      this.level = {
        currentLevel: 0,
        levelName: 'Starter',
        quizzesPlayed: 0,
        highScoreQuizzes: 0,
        totalScore: 0,
        averageScore: 0,
        levelProgress: 0,
        lastLevelUp: new Date()
      };
    }
    
    return {
      currentLevel: {
        number: currentLevel,
        name: config[currentLevel]?.name || 'Starter',
        description: config[currentLevel]?.description || 'Starting your journey',
        quizzesRequired: config[currentLevel]?.quizzesRequired || 0
      },
      nextLevel: {
        number: nextLevel,
        name: config[nextLevel]?.name || 'Rookie',
        description: config[nextLevel]?.description || 'Getting better',
        quizzesRequired: config[nextLevel]?.quizzesRequired || 2
      },
      progress: {
        quizzesPlayed: this.level.quizzesPlayed || 0,
        highScoreQuizzes: this.level.highScoreQuizzes || 0,
        progressPercentage: this.level.levelProgress || 0,
        quizzesToNextLevel: config[nextLevel]?.quizzesRequired || 2,
        highScoreQuizzesToNextLevel: config[nextLevel]?.quizzesRequired || 2
      },
      stats: {
        totalScore: this.level.totalScore || 0,
        averageScore: this.level.averageScore || 0,
        lastLevelUp: this.level.lastLevelUp || new Date(),
        highScoreRate: this.level.quizzesPlayed > 0 ? Math.round((this.level.highScoreQuizzes / this.level.quizzesPlayed) * 100) : 0
      }
    };
  } catch (error) {
    console.error('Error in getLevelInfo:', error);
    
    // Return default level info if there's an error
    return {
      currentLevel: { number: 0, name: 'Starter', description: 'Starting your journey', quizzesRequired: 0 },
      nextLevel: { number: 1, name: 'Rookie', description: 'Begin your quiz journey', quizzesRequired: 2 },
      progress: { quizzesPlayed: 0, highScoreQuizzes: 0, progressPercentage: 0, quizzesToNextLevel: 2, highScoreQuizzesToNextLevel: 2 },
      stats: { totalScore: 0, averageScore: 0, lastLevelUp: new Date(), highScoreRate: 0 }
    };
  }
};

// Method to check if user can attempt a quiz (single attempt system)
userSchema.methods.canAttemptQuiz = async function(quizId) {
  const existingQuiz = this.quizBestScores.find(q => q.quizId.toString() === quizId.toString());
  
  // Also check QuizAttempt collection for consistency
  const QuizAttempt = require('./QuizAttempt');
  const quizAttempt = await QuizAttempt.findOne({ 
    user: this._id, 
    quiz: quizId 
  });
  
  // If either system shows the quiz was attempted, consider it attempted
  if (existingQuiz || quizAttempt) {
    const bestScore = existingQuiz ? existingQuiz.bestScorePercentage : (quizAttempt ? quizAttempt.scorePercentage : null);
    const isHighScore = existingQuiz ? existingQuiz.isHighScore : (quizAttempt ? quizAttempt.scorePercentage >= 75 : false);
    
    return {
      canAttempt: false,
      attemptsLeft: 0,
      attemptNumber: 1,
      bestScore: bestScore,
      isHighScore: isHighScore
    };
  }
  
  // User has not attempted this quiz
  return { canAttempt: true, attemptsLeft: 1, attemptNumber: 1, bestScore: null };
};

// Method to update quiz best score after attempt
userSchema.methods.updateQuizBestScore = function(quizId, score, totalQuestions) {
  const scorePercentage = Math.round((score / totalQuestions) * 100);
  const isHighScore = scorePercentage >= 75; // 75% threshold for high scores
  
  let existingQuizIndex = this.quizBestScores.findIndex(q => q.quizId.toString() === quizId.toString());
  
  if (existingQuizIndex === -1) {
    // First attempt for this quiz
    this.quizBestScores.push({
      quizId,
      bestScore: score,
      bestScorePercentage: scorePercentage,
      isHighScore,
      lastAttemptDate: new Date()
    });
  } else {
    // Update existing quiz score (should not happen in single attempt system)
    const existingQuiz = this.quizBestScores[existingQuizIndex];
    
    // Update best score if current score is higher
    if (scorePercentage > existingQuiz.bestScorePercentage) {
      existingQuiz.bestScore = score;
      existingQuiz.bestScorePercentage = scorePercentage;
      existingQuiz.isHighScore = isHighScore;
    }
    
    existingQuiz.lastAttemptDate = new Date();
  }
  
  return {
    bestScore: this.quizBestScores.find(q => q.quizId.toString() === quizId.toString()),
    isNewBestScore: scorePercentage >= 75 && (existingQuizIndex === -1 || !this.quizBestScores[existingQuizIndex].isHighScore)
  };
};

// Method to get quiz attempt status
userSchema.methods.getQuizAttemptStatus = function(quizId) {
  const existingQuiz = this.quizBestScores.find(q => q.quizId.toString() === quizId.toString());
  
  if (!existingQuiz) {
    return {
      hasAttempted: false,
      attemptsLeft: 1,
      bestScore: null,
      isHighScore: false,
      canAttempt: true
    };
  }
  
  return {
    hasAttempted: true,
    attemptsLeft: 0,
    bestScore: existingQuiz.bestScorePercentage,
    isHighScore: existingQuiz.isHighScore,
    canAttempt: false,
    attemptsUsed: 1
  };
};

// Method to check subscription access for levels
userSchema.methods.canAccessLevel = function(levelNumber) {
  // Admin users have access to all levels (0-10) regardless of subscription
  if (this.role === 'admin') {
    return {
      canAccess: true,
      userPlan: 'admin',
      accessibleLevels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      requiredPlan: 'admin'
    };
  }

  // Regular users follow subscription-based access
  const subscriptionAccess = {
    'free': [0, 1, 2, 3],
    'basic': [0, 1, 2, 3, 4, 5, 6],
    'premium': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    'pro': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  };

  const userPlan = this.subscriptionStatus || 'free';
  const accessibleLevels = subscriptionAccess[userPlan] || [0, 1, 2, 3];

  return {
    canAccess: accessibleLevels.includes(levelNumber),
    userPlan: userPlan,
    accessibleLevels: accessibleLevels,
    requiredPlan: this.getRequiredPlanForLevel(levelNumber)
  };
};

// Method to get required plan for a specific level
userSchema.methods.getRequiredPlanForLevel = function(levelNumber) {
  // Admin users don't need any specific plan - they have access to all levels
  if (this.role === 'admin') {
    return 'admin';
  }
  
  // Regular users follow subscription-based requirements
  if (levelNumber <= 3) return 'free';
  if (levelNumber <= 6) return 'basic';
  if (levelNumber <= 9) return 'premium';
  return 'pro';
};

// Method to check if user profile is complete
userSchema.methods.isProfileComplete = function() {
  return this.getProfileCompletionPercentage() === 100;
};

// Method to get profile completion percentage
userSchema.methods.getProfileCompletionPercentage = function() {
  const requiredFields = [
    { field: 'name', validator: (value) => value && value.trim() !== '' },
    { field: 'email', validator: (value) => value && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) },
    { field: 'phone', validator: (value) => value && /^[0-9]{10}$/.test(value) },
    { field: 'socialLinks', validator: (value) => {
      if (!value) return false;
      // Check if at least one social media link is provided
      const socialPlatforms = ['instagram', 'facebook', 'x', 'youtube'];
      return socialPlatforms.some(platform => value[platform] && value[platform].trim() !== '');
    }}
  ];
  
  let completedFields = 0;
  
  for (const { field, validator } of requiredFields) {
    if (validator(this[field])) {
      completedFields++;
    }
  }
  
  return Math.round((completedFields / requiredFields.length) * 100);
};

// Method to get profile completion details
userSchema.methods.getProfileCompletionDetails = function() {
  const fields = [
    { 
      name: 'Full Name', 
      field: 'name', 
      completed: this.name && this.name.trim() !== '',
      value: this.name || ''
    },
    { 
      name: 'Email Address', 
      field: 'email', 
      completed: this.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email),
      value: this.email || ''
    },
    { 
      name: 'Phone Number', 
      field: 'phone', 
      completed: this.phone && /^[0-9]{10}$/.test(this.phone),
      value: this.phone || ''
    },
    { 
      name: 'Social Media Link', 
      field: 'socialLinks', 
      completed: this.socialLinks && (() => {
        const socialPlatforms = ['instagram', 'facebook', 'x', 'youtube'];
        return socialPlatforms.some(platform => this.socialLinks[platform] && this.socialLinks[platform].trim() !== '');
      })(),
      value: this.socialLinks ? Object.values(this.socialLinks).filter(link => link && link.trim() !== '').join(', ') : ''
    }
  ];
  
  const percentage = this.getProfileCompletionPercentage();
  
  return {
    percentage,
    isComplete: percentage === 100,
    fields,
    completedFields: fields.filter(f => f.completed).length,
    totalFields: fields.length
  };
};

module.exports = mongoose.model('User', userSchema);
