const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const WalletTransaction = require('../models/WalletTransaction');

// Helper function for pagination
const getPaginationOptions = (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// Helper function for search
const getSearchQuery = (req, searchFields) => {
  const search = req.query.search;
  if (!search) return {};
  
  const searchRegex = new RegExp(search, 'i');
  const searchQuery = {};
  
  searchFields.forEach(field => {
    searchQuery[field] = searchRegex;
  });
  
  return searchQuery;
};

exports.getStats = async (req, res) => {
  try {
    const categories = await Category.countDocuments();
    const subcategories = await Subcategory.countDocuments();
    const quizzes = await Quiz.countDocuments();
    const questions = await Question.countDocuments();
    const students = await User.countDocuments({ role: 'student' });
    res.json({ categories, subcategories, quizzes, questions, students });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};

// ---------------- Category ----------------
exports.getCategories = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);
    const searchQuery = getSearchQuery(req, ['name', 'description']);
    
    const categories = await Category.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get subcategory count for each category
    const categoryIds = categories.map(cat => cat._id);
    const subcategoryCounts = await Subcategory.aggregate([
      { $match: { category: { $in: categoryIds } } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const subcategoryCountMap = {};
    subcategoryCounts.forEach(sc => { subcategoryCountMap[sc._id.toString()] = sc.count; });

    const categoriesWithSubcategoryCount = categories.map(cat => {
      const catObj = cat.toObject();
      catObj.subcategoryCount = subcategoryCountMap[cat._id.toString()] || 0;
      return catObj;
    });

    const total = await Category.countDocuments(searchQuery);
    const totalPages = Math.ceil(total / limit);

    res.json({
      categories: categoriesWithSubcategoryCount,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    // Check if category already exists
    const existingCategory = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingCategory) {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }
    
    const category = new Category({ name, description });
    await category.save();
    res.status(201).json({message: "🎉 Category Created Successfully!", category: category});
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category', details: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = await Category.findByIdAndUpdate(req.params.id, { name, description }, { new: true });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: "🎉 Category Updated Successfully!", category });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

// ---------------- Subcategory ----------------
exports.getSubcategories = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);
    const searchQuery = getSearchQuery(req, ['name']);
    
    const subcategories = await Subcategory.find(searchQuery)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get quiz count for each subcategory
    const subcategoryIds = subcategories.map(sc => sc._id);
    const quizCounts = await Quiz.aggregate([
      { $match: { subcategory: { $in: subcategoryIds } } },
      { $group: { _id: '$subcategory', count: { $sum: 1 } } }
    ]);
    const quizCountMap = {};
    quizCounts.forEach(qc => { quizCountMap[qc._id.toString()] = qc.count; });

    // Add quizCount inside each subcategory object (ensure plain object)
    const subcategoriesWithQuizCount = subcategories.map(sc => {
      const scObj = sc.toObject();
      scObj.quizCount = quizCountMap[sc._id.toString()] || 0;
      return scObj;
    });

    const total = await Subcategory.countDocuments(searchQuery);
    const totalPages = Math.ceil(total / limit);

    res.json({
      subcategories: subcategoriesWithQuizCount,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error getting subcategories:', error);
    res.status(500).json({ error: 'Failed to get subcategories' });
  }
};

exports.createSubcategory = async (req, res) => {
  try {
    const { name, category, description } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }
    
    const subcategory = new Subcategory({ name, category, description });
    await subcategory.save();
    
    res.status(201).json({ message: "🎉 Subcategory Created Successfully!", subcategory });
  } catch (error) {
    console.error('Error creating subcategory:', error);
    res.status(500).json({ error: 'Failed to create subcategory', details: error.message });
  }
};

exports.updateSubcategory = async (req, res) => {
  try {
    const { name, category } = req.body;
    const subcategory = await Subcategory.findByIdAndUpdate(req.params.id, { name, category }, { new: true });
    if (!subcategory) return res.status(404).json({ message: 'Subcategory not found' });
    res.json({ message: "🎉 Subcategory Updated Successfully!", subcategory });
  } catch (error) {
    console.error('Error updating subcategory:', error);
    res.status(500).json({ error: 'Failed to update subcategory' });
  }
};

exports.deleteSubcategory = async (req, res) => {
  try {
    const subcategory = await Subcategory.findByIdAndDelete(req.params.id);
    if (!subcategory) return res.status(404).json({ message: 'Subcategory not found' });
    res.json({ message: 'Subcategory deleted successfully' });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ error: 'Failed to delete subcategory' });
  }
};

// ---------------- Quiz ----------------
exports.getQuizzes = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);
    const searchQuery = getSearchQuery(req, ['title', 'description', 'tags']);
    
    const quizzes = await Quiz.find(searchQuery)
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get question count for each quiz
    const quizIds = quizzes.map(q => q._id);
    const questionCounts = await Question.aggregate([
      { $match: { quiz: { $in: quizIds } } },
      { $group: { _id: '$quiz', count: { $sum: 1 } } }
    ]);
    const questionCountMap = {};
    questionCounts.forEach(qc => { questionCountMap[qc._id.toString()] = qc.count; });

    const quizzesWithQuestionCount = quizzes.map(q => {
      const qObj = q.toObject();
      qObj.questionCount = questionCountMap[q._id.toString()] || 0;
      return qObj;
    });

    const total = await Quiz.countDocuments(searchQuery);
    const totalPages = Math.ceil(total / limit);

    res.json({
      quizzes: quizzesWithQuestionCount,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error getting quizzes:', error);
    res.status(500).json({ error: 'Failed to get quizzes' });
  }
};

exports.createQuiz = async (req, res) => {
  try {
    const { 
      title, 
      category, 
      subcategory, 
      totalMarks, 
      timeLimit,
      description,
      difficulty,
      requiredLevel,
      recommendedLevel,
      levelRange,
      tags,
      isActive
    } = req.body;
    
    const quiz = new Quiz({ 
      title, 
      category, 
      subcategory, 
      totalMarks, 
      timeLimit,
      description,
      difficulty: difficulty || 'beginner',
      requiredLevel: requiredLevel || 1,
      recommendedLevel: recommendedLevel || 1,
      levelRange: levelRange || { min: 0, max: 10 },
      tags: tags || [],
      isActive: isActive !== undefined ? isActive : true
    });
    
    await quiz.save();
    res.status(201).json({
      message: "🎉 Level-based Quiz Created Successfully!",
      quiz: quiz
    });
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ 
      error: 'Failed to create quiz',
      details: error.message 
    });
  }
};

exports.updateQuiz = async (req, res) => {
  try {
    const { 
      title, 
      category, 
      subcategory, 
      totalMarks, 
      timeLimit,
      description,
      difficulty,
      requiredLevel,
      recommendedLevel,
      levelRange,
      tags,
      isActive
    } = req.body;
    
    const updateData = {
      title, 
      category, 
      subcategory, 
      totalMarks, 
      timeLimit,
      description,
      difficulty,
      requiredLevel,
      recommendedLevel,
      levelRange,
      tags,
      isActive
    };
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    const quiz = await Quiz.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    
    res.json({
      message: "🎉 Quiz Updated Successfully!",
      quiz: quiz
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({ 
      error: 'Failed to update quiz',
      details: error.message 
    });
  }
};

exports.deleteQuiz = async (req, res) => {
  const quiz = await Quiz.findByIdAndDelete(req.params.id);
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
  res.json({ message: 'Quiz deleted' });
};

// ---------------- Question ----------------
exports.getQuestions = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);
    const searchQuery = getSearchQuery(req, ['questionText']);
    
    const questions = await Question.find(searchQuery)
      .populate('quiz', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Question.countDocuments(searchQuery);
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      questions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error getting questions:', error);
    res.status(500).json({ error: 'Failed to get questions' });
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const { quiz, questionText, options, correctAnswerIndex, timeLimit } = req.body;
    
    if (!quiz || !questionText || !options || correctAnswerIndex === undefined) {
      return res.status(400).json({ error: 'Quiz, question text, options, and correct answer are required' });
    }
    
    const question = new Question({ quiz, questionText, options, correctAnswerIndex, timeLimit });
    await question.save();
    res.status(201).json({ message: "🎉 Question Created Successfully!", question });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ error: 'Failed to create question', details: error.message });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { quiz, questionText, options, correctAnswerIndex, timeLimit } = req.body;
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { quiz, questionText, options, correctAnswerIndex, timeLimit },
      { new: true }
    );
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ message: "🎉 Question Updated Successfully!", question });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

// ---------------- Students ----------------
exports.getStudents = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);
    const searchQuery = getSearchQuery(req, ['name', 'email', 'phone']);
    searchQuery.role = 'student';
    
    const students = await User.find(searchQuery)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(searchQuery);
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      students,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error getting students:', error);
    res.status(500).json({ error: 'Failed to get students' });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { name, email, phone, status, isBlocked } = req.body;
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') return res.status(404).json({ message: 'Student not found' });
    
    student.name = name || student.name;
    student.email = email || student.email;
    student.phone = phone || student.phone;
    if (status !== undefined) student.status = status;
    if (isBlocked !== undefined) student.isBlocked = isBlocked;
    
    await student.save();
    res.json({ message: "🎉 Student Updated Successfully!", student });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') return res.status(404).json({ message: 'Student not found' });
    await student.remove();
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
};

exports.assignBadge = async (req, res) => {
  try {
    const { studentId, badge } = req.body;
    if (!studentId || !badge) return res.status(400).json({ error: 'Student ID and badge required' });
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') return res.status(404).json({ error: 'Student not found' });
    if (student.badges.includes(badge)) return res.status(400).json({ error: 'Badge already assigned' });
    student.badges.push(badge);
    await student.save();
    res.json({ message: 'Badge assigned successfully', badges: student.badges });
  } catch (error) {
    console.error('Error assigning badge:', error);
    res.status(500).json({ error: 'Failed to assign badge' });
  }
};

// Migrate existing users to free subscription
exports.migrateUsersToFree = async (req, res) => {
  try {
    // Find all users with subscriptionStatus 'none'
    const usersWithNoSubscription = await User.find({ 
      subscriptionStatus: 'none',
      role: 'student'
    });

    console.log(`Found ${usersWithNoSubscription.length} users with no subscription`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of usersWithNoSubscription) {
      try {
        console.log(`Processing user: ${user.name} (${user.email})`);

        // Create free subscription
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 10); // 10 years (effectively permanent)

        const subscription = await Subscription.create({
          user: user._id,
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
        
        // Update user subscription details
        user.subscriptionStatus = 'free';
        user.currentSubscription = subscription._id;
        user.subscriptionExpiry = subscription.endDate;
        await user.save();

        // Record the migration in wallet transaction
        await WalletTransaction.create({
          user: user._id,
          type: 'subscription_payment',
          amount: 0,
          currency: 'INR',
          description: 'Free permanent subscription migration - levels 0-3 access'
        });

        console.log(`✅ Successfully migrated user: ${user.name} (${user.email})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating user ${user.name} (${user.email}):`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Successfully migrated: ${successCount} users`);
    console.log(`❌ Failed to migrate: ${errorCount} users`);
    console.log(`📈 Total processed: ${usersWithNoSubscription.length} users`);

    res.json({
      success: true,
      message: `Migration completed! ${successCount} users migrated successfully, ${errorCount} failed.`,
      data: {
        totalUsers: usersWithNoSubscription.length,
        successCount,
        errorCount
      }
    });
  } catch (error) {
    console.error('❌ Error in migration:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
};