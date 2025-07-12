const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: { type: String, unique: true },
  password: { type: String },
  role: { type: String, enum: ['admin', 'student'], default: 'student' },
  badges: { type: [String], default: ['Student'] },
  
  // User Level System
  level: {
    currentLevel: { type: Number, default: 0 },
    levelName: { type: String, default: 'Zero Level' },
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
  
  // Legacy fields for backward compatibility (will be deprecated)
}, { timestamps: true });

// Level configuration
userSchema.statics.LEVEL_CONFIG = {
  0: { name: 'Zero Level', quizzesRequired: 0, description: 'Just registered - Start your journey!' },
  1: { name: 'Rookie', quizzesRequired: 2, description: 'Just getting started – Easy questions' },
  2: { name: 'Explorer', quizzesRequired: 4, description: 'Discover new ideas – Slightly challenging' },
  3: { name: 'Thinker', quizzesRequired: 8, description: 'Test your brain power – Moderate difficulty' },
  4: { name: 'Strategist', quizzesRequired: 16, description: 'Mix of logic, memory, and speed' },
  5: { name: 'Achiever', quizzesRequired: 32, description: 'Cross-topic challenges begin' },
  6: { name: 'Mastermind', quizzesRequired: 64, description: 'For those who always aim to win' },
  7: { name: 'Champion', quizzesRequired: 128, description: 'Beat the timer and the brain' },
  8: { name: 'Prodigy', quizzesRequired: 256, description: 'Only a few reach here – high-level puzzles' },
  9: { name: 'Quiz Wizard', quizzesRequired: 512, description: 'Complex questions across categories' },
  10: { name: 'Legend', quizzesRequired: 1024, description: 'Final frontier — only the best reach here!' }
};

// Method to calculate and update user level
userSchema.methods.updateLevel = function() {
  const config = this.constructor.LEVEL_CONFIG;
  
  // Ensure highScoreQuizzes is a valid number
  if (typeof this.level.highScoreQuizzes !== 'number' || isNaN(this.level.highScoreQuizzes)) {
    this.level.highScoreQuizzes = 0;
  }
  
  let newLevel = this.level.currentLevel;
  let newLevelName = this.level.levelName;
  
  // Find the highest level the user qualifies for based on HIGH-SCORE quizzes (75% or higher)
  for (let level = 10; level >= 0; level--) {
    if (this.level.highScoreQuizzes >= config[level].quizzesRequired) {
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
  
  // Calculate progress to next level based on HIGH-SCORE quizzes
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
    // Calculate progress within the current level (how many high-score quizzes they have out of what's needed for current level)
    const progress = Math.min(100, Math.round((this.level.highScoreQuizzes / currentLevelQuizzes) * 100));
    // Ensure progress is a valid number
    this.level.levelProgress = Math.max(0, isNaN(progress) ? 0 : progress);
  }
  
  if (levelIncreased) {
    this.level.lastLevelUp = new Date();
  }
  
  return { levelIncreased, newLevel, newLevelName };
};

// Method to add quiz completion
userSchema.methods.addQuizCompletion = function(score, totalQuestions) {
  this.level.quizzesPlayed += 1;
  this.level.totalScore += score;
  this.level.averageScore = Math.round(this.level.totalScore / this.level.quizzesPlayed) || 0;
  
  // Calculate score percentage
  const scorePercentage = (score / totalQuestions) * 100;
  
  // --- FIX: Always recalculate highScoreQuizzes from quizBestScores ---
  this.level.highScoreQuizzes = this.quizBestScores.filter(q => q.isHighScore).length || 0;
  
  const levelUpdate = this.updateLevel();
  
  // Add level-specific badges
  if (levelUpdate.levelIncreased) {
    const levelConfig = this.constructor.LEVEL_CONFIG[levelUpdate.newLevel];
    this.badges.push(`${levelConfig.name} Badge`);
  }
  
  return {
    ...levelUpdate,
    scorePercentage: Math.round(scorePercentage),
    isHighScore: scorePercentage >= 75, // 75% threshold for high scores
    highScoreQuizzes: this.level.highScoreQuizzes
  };
};

// Method to get level info
userSchema.methods.getLevelInfo = function() {
  const config = this.constructor.LEVEL_CONFIG;
  const currentLevel = this.level.currentLevel;
  const nextLevel = Math.min(currentLevel + 1, 10);
  
  return {
    currentLevel: {
      number: currentLevel,
      name: config[currentLevel].name,
      description: config[currentLevel].description,
      quizzesRequired: config[currentLevel].quizzesRequired
    },
    nextLevel: {
      number: nextLevel,
      name: config[nextLevel].name,
      description: config[nextLevel].description,
      quizzesRequired: config[nextLevel].quizzesRequired
    },
    progress: {
      quizzesPlayed: this.level.quizzesPlayed || 0,
      highScoreQuizzes: this.level.highScoreQuizzes || 0,
      progressPercentage: isNaN(this.level.levelProgress) ? 0 : this.level.levelProgress,
      quizzesToNextLevel: config[nextLevel].quizzesRequired - (this.level.highScoreQuizzes || 0),
      highScoreQuizzesToNextLevel: config[nextLevel].quizzesRequired - (this.level.highScoreQuizzes || 0)
    },
    stats: {
      totalScore: this.level.totalScore || 0,
      averageScore: this.level.averageScore || 0,
      lastLevelUp: this.level.lastLevelUp,
      highScoreRate: (this.level.quizzesPlayed || 0) > 0 ? Math.round(((this.level.highScoreQuizzes || 0) / (this.level.quizzesPlayed || 1)) * 100) : 0
    }
  };
};

// Method to check if user can attempt a quiz (single attempt system)
userSchema.methods.canAttemptQuiz = function(quizId) {
  const existingQuiz = this.quizBestScores.find(q => q.quizId.toString() === quizId.toString());
  
  if (!existingQuiz) {
    return { canAttempt: true, attemptsLeft: 1, attemptNumber: 1, bestScore: null };
  }
  
  // User has already attempted this quiz
  return {
    canAttempt: false,
    attemptsLeft: 0,
    attemptNumber: 1,
    bestScore: existingQuiz.bestScorePercentage,
    isHighScore: existingQuiz.isHighScore
  };
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

module.exports = mongoose.model('User', userSchema);
