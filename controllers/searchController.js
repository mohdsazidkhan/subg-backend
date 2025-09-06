const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const searchAll = async (req, res) => {
  try {
    const { query = '', page = 1, limit = 10 } = req.query;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentLevel = user.level.currentLevel;
    const nextLevel = currentLevel + 1;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const regex = new RegExp(query, 'i'); // case-insensitive partial match

    // ✅ Get attempted quiz IDs
    const attemptedQuizIds = await QuizAttempt.find({ user: userId }).distinct('quiz');

    // Check user's level access permissions for next level
    const levelAccess = user.canAccessLevel(nextLevel);
    if (!levelAccess.canAccess) {
      return res.status(403).json({ 
        message: `You need a ${levelAccess.requiredPlan} subscription to access level ${nextLevel} quizzes`,
        requiredPlan: levelAccess.requiredPlan,
        accessibleLevels: levelAccess.accessibleLevels
      });
    }

    // ✅ Search categories and subcategories
    const [categories, subcategories] = await Promise.all([
      Category.find({
        $or: [{ name: regex }, { description: regex }]
      }).select('_id name description'),

      Subcategory.find({
        $or: [{ name: regex }, { description: regex }]
      }).select('_id name category description')
        .populate('category', '_id name')
    ]);

    const matchedCategoryIds = categories.map(cat => cat._id);
    const matchedSubcategoryIds = subcategories.map(sub => sub._id);

    // ✅ Build quiz filter with "not attempted" and next level quizzes
    const quizFilter = {
      isActive: true,
      requiredLevel: nextLevel, // Show quizzes from next level only
      _id: { $nin: attemptedQuizIds }, // <-- Exclude attempted
      $or: [
        { title: regex },
        { description: regex },
        { category: { $in: matchedCategoryIds } },
        { subcategory: { $in: matchedSubcategoryIds } }
      ]
    };

    const [quizzes, quizCount] = await Promise.all([
      Quiz.find(quizFilter)
        .select('_id title category subcategory requiredLevel')
        .populate('category', '_id name')
        .populate('subcategory', '_id name')
        .skip(skip)
        .limit(parseInt(limit)),

      Quiz.countDocuments(quizFilter)
    ]);

    res.json({
      success: true,
      currentLevel: currentLevel,
      nextLevel: nextLevel,
      userLevel: {
        currentLevel: currentLevel,
        levelName: user.level.levelName,
        progress: user.level.levelProgress,
        highScoreQuizzes: user.level.highScoreQuizzes,
        totalQuizzesPlayed: user.level.quizzesPlayed
      },
      levelAccess: {
        accessibleLevels: levelAccess.accessibleLevels,
        userPlan: levelAccess.userPlan
      },
      page: parseInt(page),
      limit: parseInt(limit),
      totalQuizzes: quizCount,
      totalPages: Math.ceil(quizCount / limit),
      categories,
      subcategories,
      quizzes
    });

  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};



module.exports = { searchAll };
