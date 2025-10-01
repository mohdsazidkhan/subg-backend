// controllers/quizController.js
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
// Rewards are now handled by the monthly rewards system

exports.attemptQuiz = async (req, res) => {
  try {
    const studentId = req.user.id;
    const quizId = req.params.quizid;

    const user = await User.findById(studentId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check subscription status
    if (user.subscriptionStatus === 'none') {
      return res.status(403).json({ 
        message: 'Subscription required to attempt quizzes. Please upgrade your plan.',
        requiresUpgrade: true
      });
    }

    // Check if user can attempt this quiz (single attempt system)
    const attemptStatus = await user.canAttemptQuiz(quizId);
    if (!attemptStatus.canAttempt) {
      return res.status(400).json({ 
        message: 'You have already attempted this quiz.',
        attemptsUsed: 1,
        bestScore: attemptStatus.bestScore,
        isHighScore: attemptStatus.isHighScore
      });
    }

    const { answers } = req.body; // answers: ["option string", ...]

    const questions = await Question.find({ quiz: quizId });

    if (!questions.length) {
      return res.status(404).json({ message: 'No questions found for this quiz' });
    }

    if (!answers || answers.length !== questions.length) {
      return res.status(400).json({ message: 'All questions must be answered or skipped' });
    }

    let score = 0;
    let skippedQuestions = 0;
    const answerRecords = [];

    questions.forEach((q, i) => {
      // Get the correct answer string from the index
      const correctAnswer = q.options[q.correctAnswerIndex];
      const submittedAnswer = answers[i];
      
      // Handle SKIP answers
      if (submittedAnswer === 'SKIP') {
        skippedQuestions++;
        answerRecords.push({
          questionId: q._id,
          answer: 'SKIP',
          isSkipped: true
        });
        return; // Skip scoring for this question
      }
      
      const isCorrect = submittedAnswer === correctAnswer;
      if (isCorrect) score++;

      answerRecords.push({
        questionId: q._id,
        answer: submittedAnswer,
        isSkipped: false
      });
    });

    // Calculate score percentage based on total questions (regardless of skipped questions)
    const answeredQuestions = questions.length - skippedQuestions;
    const scorePercentage = Math.round((score / questions.length) * 100);

    // Create quiz attempt record
    const attempt = new QuizAttempt({
      user: studentId,
      quiz: quizId,
      answers: answerRecords,
      score,
      scorePercentage,
      isBestScore: true // Always true in single attempt system
    });

    await attempt.save();

    // Update user's best score for this quiz
    const bestScoreUpdate = user.updateQuizBestScore(quizId, score, questions.length);
    
    // Update attempt record if it's the best score (always true in single attempt)
    if (bestScoreUpdate.isNewBestScore) {
      await QuizAttempt.findByIdAndUpdate(attempt._id, { isBestScore: true });
    }

    // Update user level based on quiz completion (for every attempt)
    let levelUpdate = null;
    levelUpdate = user.addQuizCompletion(score, questions.length);
    
    // Calculate and update accuracy from quizBestScores array
    const calculateAccuracyFromBestScores = (quizBestScores) => {
      if (!quizBestScores || quizBestScores.length === 0) {
        return 0;
      }
      const totalPercentage = quizBestScores.reduce((sum, quiz) => {
        return sum + (quiz.bestScorePercentage || 0);
      }, 0);
      return Math.round(totalPercentage / quizBestScores.length);
    };
    
    // Update monthlyProgress.accuracy with calculated value
    const calculatedAccuracy = calculateAccuracyFromBestScores(user.quizBestScores);
    user.ensureMonthlyProgress(); // Ensure monthlyProgress exists
    user.monthlyProgress.accuracy = calculatedAccuracy;
    await user.save();

    // Note: Rewards are now handled by the monthly rewards system
    // Top 10 eligible users at Level 10 (configurable high-score quizzes) win from configurable prize pool each month

    // Add badge for perfect score (if user has pro subscription)
    if (score === questions.length && user.subscriptionStatus === 'pro') {
      await User.findByIdAndUpdate(studentId, {
        $addToSet: { badges: 'Perfect Scorer' }
      });
    }

    // Get updated level info
    const levelInfo = user.getLevelInfo();

    res.json({
      total: questions.length,
      answered: answeredQuestions,
      skipped: skippedQuestions,
      score,
      scorePercentage,
      attemptNumber: 1,
      attemptsLeft: 0,
      bestScore: bestScoreUpdate.bestScore.bestScorePercentage,
      isNewBestScore: bestScoreUpdate.isNewBestScore,
      isHighScore: scorePercentage >= 75,
      correctAnswers: questions.map((q) => q.options[q.correctAnswerIndex]),
      attemptId: attempt._id,
      subscriptionStatus: user.subscriptionStatus,
      levelUpdate: levelUpdate ? {
        levelIncreased: levelUpdate.levelIncreased,
        newLevel: levelUpdate.newLevel,
        newLevelName: levelUpdate.newLevelName,
        levelInfo: levelInfo,
        monthly: levelUpdate.monthly
      } : null,
      message: bestScoreUpdate.isNewBestScore 
        ? `Quiz completed! Score: ${scorePercentage}% (${score}/${questions.length} total questions) - New best score! Counts towards level progression!` 
        : `Quiz completed! Score: ${scorePercentage}% (${score}/${questions.length} total questions) - Quiz attempted successfully.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getQuizWithQuestions = async (req, res) => {
  try {
    const quizId = req.params.quizid;

    // Get quiz basic info with populated category and subcategory
    const quiz = await Quiz.findById(quizId)
      .populate('category', 'name')
      .populate('subcategory', 'name');
    
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // Get all questions for this quiz
    const questions = await Question.find({ quiz: quizId });

    if (!questions.length) {
      return res.status(404).json({ error: 'No questions found for this quiz' });
    }

    // Return complete quiz data with questions
    res.json({
      ...quiz.toObject(),
      questions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get quiz result for a specific quiz
exports.getQuizResult = async (req, res) => {
  try {
    const quizId = req.params.quizid;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: No user info found' });
    }

    // Get the quiz attempt for this user and quiz
    const quizAttempt = await QuizAttempt.findOne({ 
      user: userId, 
      quiz: quizId 
    }).populate({
      path: 'quiz',
      populate: [
        { path: 'category', select: 'name' },
        { path: 'subcategory', select: 'name' }
      ]
    });

    if (!quizAttempt) {
      return res.status(404).json({ 
        success: false, 
        message: 'No quiz attempt found for this quiz' 
      });
    }

    // Format the result data to match frontend expectations
    const resultData = {
      _id: quizAttempt._id,
      quizId: quizAttempt.quiz._id,
      quizTitle: quizAttempt.quiz.title,
      categoryName: quizAttempt.quiz.category?.name || 'Unknown Category',
      subcategoryName: quizAttempt.quiz.subcategory?.name || 'Unknown Subcategory',
      score: quizAttempt.score,
      scorePercentage: quizAttempt.scorePercentage,
      attemptedAt: quizAttempt.attemptedAt,
      isHighScore: quizAttempt.isBestScore,
      rank: quizAttempt.rank || 0,
      totalQuestions: quizAttempt.answers?.length || 0
    };

    res.json({
      success: true,
      data: resultData
    });
  } catch (err) {
    console.error('Error fetching quiz result:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};

// Get quizzes filtered by user level
exports.getQuizzesByLevel = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: No user info found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.updateLevel();
    await user.save();

    const currentLevel = user.level.currentLevel;
    const nextLevel = currentLevel + 1;
    const { category, subcategory, difficulty, level, limit = 20, page = 1 } = req.query;

    // Check user's level access permissions for target level
    // If user is at level 10, check access for level 10, otherwise check next level
    const targetLevel = currentLevel === 10 ? 10 : nextLevel;
    const levelAccess = user.canAccessLevel(targetLevel);
    if (!levelAccess.canAccess) {
      return res.status(403).json({
        message: `You need a ${levelAccess.requiredPlan} subscription to access level ${targetLevel} quizzes`,
        requiredPlan: levelAccess.requiredPlan,
        accessibleLevels: levelAccess.accessibleLevels
      });
    }

    let query = { isActive: true };

    // Show quizzes from target level
    query.requiredLevel = targetLevel;

    if (category?.trim()) query.category = category;
    if (subcategory?.trim()) query.subcategory = subcategory;
    if (['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty)) {
      query.difficulty = difficulty;
    }

    const allQuizzes = await Quiz.find(query)
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 });
    
    // Randomize the order of quizzes
    const shuffledQuizzes = allQuizzes.sort(() => Math.random() - 0.5);

    const attemptedQuizIds = await QuizAttempt.find({ user: userId }).distinct('quiz');
    const attemptedQuizIdStrings = attemptedQuizIds.map(id => id.toString());

    // ✅ Filter out attempted quizzes
    const filteredQuizzes = shuffledQuizzes.filter(
      quiz => !attemptedQuizIdStrings.includes(quiz._id.toString())
    );

    // Get question count per quiz
    const quizIds = filteredQuizzes.map(q => q._id);
    const questionCounts = await Question.aggregate([
      { $match: { quiz: { $in: quizIds } } },
      { $group: { _id: '$quiz', count: { $sum: 1 } } }
    ]);
    const questionCountMap = {};
    questionCounts.forEach(qc => {
      questionCountMap[qc._id.toString()] = qc.count;
    });

    // Pagination
    const filteredCount = filteredQuizzes.length;
    const totalPages = Math.ceil(filteredCount / limit);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedQuizzes = filteredQuizzes.slice(skip, skip + parseInt(limit));

    const quizzesWithAttemptStatus = paginatedQuizzes.map(quiz => {
      const attemptStatus = user.getQuizAttemptStatus(quiz._id);
      const quizObj = {
        ...quiz.toObject(),
        attemptStatus: {
          hasAttempted: attemptStatus.hasAttempted,
          attemptsLeft: attemptStatus.attemptsLeft,
          bestScore: attemptStatus.bestScore,
          isHighScore: attemptStatus.isHighScore,
          canAttempt: attemptStatus.canAttempt,
          attemptsUsed: attemptStatus.attemptsUsed || 0
        },
        isRecommended: level && level !== ''
          ? quiz.requiredLevel === parseInt(level)
          : quiz.requiredLevel === nextLevel,
        levelMatch: {
          exact: quiz.requiredLevel === nextLevel,
          withinRange: quiz.requiredLevel >= Math.max(0, nextLevel - 1) &&
                       quiz.requiredLevel <= Math.min(10, nextLevel + 1)
        }
      };
      quizObj.questionCount = questionCountMap[quiz._id.toString()] || 0;
      return quizObj;
    });

    res.json({
      success: true,
      data: quizzesWithAttemptStatus,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalQuizzes: filteredCount,
        hasNextPage: skip + paginatedQuizzes.length < filteredCount,
        hasPrevPage: page > 1
      },
      userLevel: {
        currentLevel: currentLevel,
        nextLevel: nextLevel,
        levelName: user.level.levelName,
        progress: user.level.levelProgress
      },
      levelAccess: {
        accessibleLevels: levelAccess.accessibleLevels,
        userPlan: levelAccess.userPlan
      }
    });
  } catch (err) {
    console.error('Error fetching quizzes by level:', err);
    res.status(500).json({ error: err.message });
  }
};


// Get recommended quizzes for user's level
exports.getRecommendedQuizzes = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: No user info found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure level progress is calculated correctly
    user.updateLevel();
    await user.save();

    const currentLevel = user.level.currentLevel;
    const nextLevel = currentLevel + 1;
    const limit = parseInt(req.query.limit) || 5;

    // Get attempted quiz IDs for this user
    const attemptedQuizIds = await QuizAttempt.find({ user: userId })
      .distinct('quiz');

    // Get quizzes that are perfect for user's next level (excluding attempted ones)
    // If user is at level 10, show level 10 quizzes
    const targetLevel = currentLevel === 10 ? 10 : nextLevel;
    const recommendedQuizzes = await Quiz.find({
      isActive: true,
      requiredLevel: targetLevel,
      _id: { $nin: attemptedQuizIds } // Exclude attempted quizzes
    })
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .sort({ createdAt: -1 })
    .limit(limit);

    const quizzesWithStatus = recommendedQuizzes.map(quiz => ({
      ...quiz.toObject(),
      hasAttempted: false, // These quizzes haven't been attempted
      canAttempt: true     // User can attempt these quizzes
    }));

    res.json({
      success: true,
      data: quizzesWithStatus,
      userLevel: {
        currentLevel: currentLevel,
        nextLevel: nextLevel,
        levelName: user.level.levelName
      }
    });
  } catch (err) {
    console.error('Error fetching recommended quizzes:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get quiz difficulty distribution for user's level
exports.getQuizDifficultyDistribution = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: No user info found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure level progress is calculated correctly
    user.updateLevel();
    await user.save();

    const userLevel = user.level.currentLevel;
    const targetLevel = userLevel === 10 ? 10 : userLevel;

    // Get difficulty distribution for user's level
    const difficultyStats = await Quiz.aggregate([
      {
        $match: {
          isActive: true,
          requiredLevel: targetLevel
        }
      },
      {
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get level distribution
    const levelStats = await Quiz.aggregate([
      {
        $match: {
          isActive: true,
          requiredLevel: targetLevel
        }
      },
      {
        $group: {
          _id: '$requiredLevel',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      difficultyDistribution: difficultyStats,
      levelDistribution: levelStats,
      userLevel: {
        currentLevel: userLevel,
        levelName: user.level.levelName
      }
    });
  } catch (err) {
    console.error('Error fetching quiz distribution:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get level-based quizzes for home page display
exports.getHomePageLevelQuizzes = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: No user info found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure level progress is calculated correctly
    user.updateLevel();
    await user.save();

    const currentLevel = user.level.currentLevel;
    const nextLevel = currentLevel + 1;
    const limit = parseInt(req.query.limit) || 6; // Show 6 quizzes on home page

    // Check user's level access permissions for target level
    // If user is at level 10, check access for level 10, otherwise check next level
    const targetLevel = currentLevel === 10 ? 10 : nextLevel;
    const levelAccess = user.canAccessLevel(targetLevel);
    if (!levelAccess.canAccess) {
      return res.status(403).json({ 
        message: `You need a ${levelAccess.requiredPlan} subscription to access level ${targetLevel} quizzes`,
        requiredPlan: levelAccess.requiredPlan,
        accessibleLevels: levelAccess.accessibleLevels
      });
    }

    // Get attempted quiz IDs for this user
    const attemptedQuizIds = await QuizAttempt.find({ user: userId })
      .distinct('quiz');

    // Build query for next level quizzes (excluding attempted ones)
    // If user is at level 10, show level 10 quizzes
    let query = {
      isActive: true,
      requiredLevel: targetLevel, // Show quizzes from target level
      _id: { $nin: attemptedQuizIds } // Exclude attempted quizzes
    };

    const quizzes = await Quiz.find(query)
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 })
      .limit(limit);
    
    // Randomize the order of quizzes
    const shuffledQuizzes = quizzes.sort(() => Math.random() - 0.5);

    // Since we already filtered out attempted quizzes, all returned quizzes are not attempted
    const quizzesWithStatus = shuffledQuizzes.map(quiz => {
      return {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        category: quiz.category,
        subcategory: quiz.subcategory,
        difficulty: quiz.difficulty,
        requiredLevel: quiz.requiredLevel,
        timeLimit: quiz.timeLimit,
        totalMarks: quiz.totalMarks,
        isRecommended: quiz.requiredLevel === nextLevel,
        levelMatch: {
          exact: quiz.requiredLevel === nextLevel,
          withinRange: quiz.requiredLevel >= Math.max(0, nextLevel - 1) && 
                      quiz.requiredLevel <= Math.min(10, nextLevel + 1)
        },
        attemptStatus: {
          hasAttempted: false,
          canAttempt: true,
          bestScore: null,
          isHighScore: false,
          attemptedAt: null,
          attemptId: null
        }
      };
    });

    res.json({
      success: true,
      data: quizzesWithStatus,
      userLevel: {
        currentLevel: currentLevel,
        nextLevel: nextLevel,
        levelName: user.level.levelName,
        progress: user.level.levelProgress,
        highScoreQuizzes: user.level.highScoreQuizzes,
        totalQuizzesPlayed: user.level.quizzesPlayed
      },
      levelAccess: {
        accessibleLevels: levelAccess.accessibleLevels,
        userPlan: levelAccess.userPlan
      }
    });
  } catch (err) {
    console.error('Error fetching home page level quizzes:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get categories, subcategories, and level-wise quizzes excluding attempted ones
exports.getHomePageData = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: No user info found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure level progress is calculated correctly
    user.updateLevel();
    await user.save();

    const currentLevel = user.level.currentLevel;
    const nextLevel = currentLevel + 1;

    // Check user's level access permissions for target level
    // If user is at level 10, check access for level 10, otherwise check next level
    const targetLevel = currentLevel === 10 ? 10 : nextLevel;
    const levelAccess = user.canAccessLevel(targetLevel);
    if (!levelAccess.canAccess) {
      return res.status(403).json({ 
        message: `You need a ${levelAccess.requiredPlan} subscription to access level ${targetLevel} quizzes`,
        requiredPlan: levelAccess.requiredPlan,
        accessibleLevels: levelAccess.accessibleLevels
      });
    }

    // Get all categories
    const categories = await Category.find().sort({ name: 1 });

    // Get all subcategories with their categories
    const subcategories = await Subcategory.find()
      .populate('category', 'name')
      .sort({ name: 1 });

    // Get attempted quiz IDs for this user
    const attemptedQuizIds = await QuizAttempt.find({ user: userId })
      .distinct('quiz');

    // Build query for next level quizzes (excluding attempted ones)
    // If user is at level 10, show level 10 quizzes
    let query = {
      isActive: true,
      requiredLevel: targetLevel, // Show quizzes from target level
      _id: { $nin: attemptedQuizIds } // Exclude attempted quizzes
    };

    // Get quizzes grouped by level
    const quizzesByLevel = await Quiz.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subcategory',
          foreignField: '_id',
          as: 'subcategoryData'
        }
      },
      {
        $addFields: {
          category: { $arrayElemAt: ['$categoryData', 0] },
          subcategory: { $arrayElemAt: ['$subcategoryData', 0] },
          randomOrder: { $rand: {} }
        }
      },
      { $sort: { randomOrder: 1 } },
      {
        $group: {
          _id: '$requiredLevel',
          level: { $first: '$requiredLevel' },
          quizzes: {
            $push: {
              _id: '$_id',
              title: '$title',
              description: '$description',
              category: '$category',
              subcategory: '$subcategory',
              difficulty: '$difficulty',
              timeLimit: '$timeLimit',
              totalMarks: '$totalMarks',
              isRecommended: { $eq: ['$requiredLevel', nextLevel] }
            }
          },
          quizCount: { $sum: 1 }
        }
      },
      { $sort: { level: 1 } }
    ]);

    // Get quizzes grouped by category
    const quizzesByCategory = await Quiz.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subcategory',
          foreignField: '_id',
          as: 'subcategoryData'
        }
      },
      {
        $addFields: {
          category: { $arrayElemAt: ['$categoryData', 0] },
          subcategory: { $arrayElemAt: ['$subcategoryData', 0] },
          randomOrder: { $rand: {} }
        }
      },
      { $sort: { randomOrder: 1 } },
      {
        $group: {
          _id: '$category._id',
          category: { $first: '$category' },
          quizzes: {
            $push: {
              _id: '$_id',
              title: '$title',
              description: '$description',
              subcategory: '$subcategory',
              difficulty: '$difficulty',
              requiredLevel: '$requiredLevel',
              timeLimit: '$timeLimit',
              totalMarks: '$totalMarks',
              isRecommended: { $eq: ['$requiredLevel', nextLevel] }
            }
          },
          quizCount: { $sum: 1 }
        }
      },
      { $sort: { 'category.name': 1 } }
    ]);

    // Get quizzes grouped by subcategory
    const quizzesBySubcategory = await Quiz.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryData'
        }
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subcategory',
          foreignField: '_id',
          as: 'subcategoryData'
        }
      },
      {
        $addFields: {
          category: { $arrayElemAt: ['$categoryData', 0] },
          subcategory: { $arrayElemAt: ['$subcategoryData', 0] },
          randomOrder: { $rand: {} }
        }
      },
      { $sort: { randomOrder: 1 } },
      {
        $group: {
          _id: '$subcategory._id',
          subcategory: { $first: '$subcategory' },
          category: { $first: '$category' },
          quizzes: {
            $push: {
              _id: '$_id',
              title: '$title',
              description: '$description',
              difficulty: '$difficulty',
              requiredLevel: '$requiredLevel',
              timeLimit: '$timeLimit',
              totalMarks: '$totalMarks',
              isRecommended: { $eq: ['$requiredLevel', nextLevel] }
            }
          },
          quizCount: { $sum: 1 }
        }
      },
      { $sort: { 'subcategory.name': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        quizzesByLevel,
        quizzesByCategory,
        quizzesBySubcategory,
        categories, // plain list of categories
        subcategories // plain list of subcategories
      },
      userLevel: {
        currentLevel: currentLevel,
        nextLevel: nextLevel,
        levelName: user.level.levelName,
        progress: user.level.levelProgress,
        highScoreQuizzes: user.level.highScoreQuizzes,
        totalQuizzesPlayed: user.level.quizzesPlayed
      },
      levelAccess: {
        accessibleLevels: levelAccess.accessibleLevels,
        userPlan: levelAccess.userPlan
      }
    });
  } catch (err) {
    console.error('Error fetching home page data:', err);
    res.status(500).json({ error: err.message });
  }
};
