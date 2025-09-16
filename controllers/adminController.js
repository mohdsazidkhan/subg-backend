const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const WalletTransaction = require('../models/WalletTransaction');
const BankDetail = require('../models/BankDetail');
const Contact = require('../models/Contact');
const PaymentOrder = require('../models/PaymentOrder');
const QuizAttempt = require('../models/QuizAttempt');
const Article = require('../models/Article');

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
  if (!search || !search.trim()) return {};

  const searchRegex = new RegExp(search.trim(), 'i');

  return {
    $or: searchFields.map(field => ({
      [field]: searchRegex
    }))
  };
};

const getFilterQuizQuery = (req, filterFields) => {
  const filterQuery = {};

  filterFields.forEach(field => {
    const value = req.query[field];
    if (value !== undefined && value !== '') {
      if (value === 'true') {
        filterQuery[field] = true;
      } else if (value === 'false') {
        filterQuery[field] = false;
      } else if (['level', 'requiredLevel'].includes(field)) {
        filterQuery[field] = Number(value); // ✅ Cast to number
      } else {
        filterQuery[field] = value;
      }
    }
  });

  return filterQuery;
};

exports.getStats = async (req, res) => {
  try {
    const categories = await Category.countDocuments();
    const subcategories = await Subcategory.countDocuments();
    const quizzes = await Quiz.countDocuments();
    const questions = await Question.countDocuments();
    const students = await User.countDocuments({ role: 'student' });
    const bankDetails = await BankDetail.countDocuments();
    const totalQuizAttempts = await QuizAttempt.countDocuments();
    
    // Get subscription totals from User model (all users, no date filter)
    const totalSubscriptions = await User.countDocuments({});
    const activeSubscriptions = await User.countDocuments({
      subscriptionExpiry: { $exists: true, $ne: null, $gt: new Date() }
    });
    const freeSubscriptions = await User.countDocuments({
      subscriptionStatus: 'free'
    });
    const paidSubscriptions = await User.countDocuments({
      subscriptionStatus: { $nin: ['free'] }
    });
    
    // Debug logging
    // console.log('📊 Dashboard Stats:', JSON.stringify({
    //   freeSubscriptions,
    //   paidSubscriptions,
    //   activeSubscriptions,
    //   totalSubscriptions
    // }, null, 2));
    
    // Debug: Check basic users with expiry dates
    const basicUsers = await User.find({ subscriptionStatus: 'basic' }).select('name subscriptionStatus subscriptionExpiry');
    const basicUsersData = basicUsers.map(user => ({
      name: user.name,
      status: user.subscriptionStatus,
      expiry: user.subscriptionExpiry,
      isExpired: user.subscriptionExpiry ? new Date() > new Date(user.subscriptionExpiry) : 'No expiry date',
      currentDate: new Date().toISOString()
    }));
    // console.log('🔍 Basic Users with Expiry Dates:', JSON.stringify(basicUsersData, null, 2));
    
    // Debug: Test different queries
    const basicUsersCount = await User.countDocuments({ subscriptionStatus: 'basic' });
    const basicUsersWithExpiry = await User.countDocuments({ 
      subscriptionStatus: 'basic',
      subscriptionExpiry: { $exists: true, $ne: null }
    });
    const basicUsersActive = await User.countDocuments({ 
      subscriptionStatus: 'basic',
      subscriptionExpiry: { $exists: true, $ne: null, $gt: new Date() }
    });
    
    // Debug: Count all users with future expiry dates (regardless of subscription status)
    const allUsersWithFutureExpiry = await User.countDocuments({
      subscriptionExpiry: { $exists: true, $ne: null, $gt: new Date() }
    });
    
    // console.log('🔍 Basic Users Debug:', JSON.stringify({
    //   totalBasic: basicUsersCount,
    //   withExpiry: basicUsersWithExpiry,
    //   active: basicUsersActive,
    //   allUsersWithFutureExpiry: allUsersWithFutureExpiry,
    //   currentDate: new Date().toISOString()
    // }, null, 2));
    
    // Get payment order totals
    const totalPaymentOrders = await PaymentOrder.countDocuments();
    const completedPaymentOrders = await PaymentOrder.countDocuments({
      payuStatus: 'success'
    });
    
    // Get total revenue from completed payments
    const revenueSummary = await PaymentOrder.aggregate([
      { $match: { payuStatus: 'success' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' }
        }
      }
    ]);
    
    const totalRevenue = revenueSummary[0]?.totalRevenue || 0;
    
    res.json({ 
      categories, 
      subcategories, 
      quizzes, 
      questions, 
      students, 
      bankDetails,
      totalQuizAttempts,
      subscriptions: totalSubscriptions,
      activeSubscriptions,
      freeSubscriptions,
      paidSubscriptions,
      paymentOrders: totalPaymentOrders,
      completedPaymentOrders,
      totalRevenue
    });
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
    //console.log(searchQuery, ':searchQuery');
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
// ---------------- Get All Quizzes ----------------
exports.getAllAdminQuizzes = async (req, res) => {
  try {
    const searchQuery = getSearchQuery(req, ['title', 'description', 'tags']);

    const quizzes = await Quiz.find(searchQuery)
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 });

    const quizIds = quizzes.map(q => q._id);
    const questionCounts = await Question.aggregate([
      { $match: { quiz: { $in: quizIds } } },
      { $group: { _id: '$quiz', count: { $sum: 1 } } }
    ]);
    const questionCountMap = {};
    questionCounts.forEach(qc => {
      questionCountMap[qc._id.toString()] = qc.count;
    });

    const quizzesWithQuestionCount = quizzes.map(q => {
      const qObj = q.toObject();
      qObj.questionCount = questionCountMap[q._id.toString()] || 0;
      return qObj;
    });

    res.json({
      quizzes: quizzesWithQuestionCount,
      total: quizzes.length
    });
  } catch (error) {
    console.error('Error getting all quizzes:', error);
    res.status(500).json({ error: 'Failed to get all quizzes' });
  }
};

// ---------------- Quiz ----------------
exports.getQuizzes = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);

    const searchQuery = getSearchQuery(req, ['title', 'description', 'tags']);
    const filterQuery = getFilterQuizQuery(req, [
      'difficulty',
      'category',
      'subcategory',
      'isActive',
      'requiredLevel'
    ]);

    const finalQuery = { ...searchQuery, ...filterQuery };

    const quizzes = await Quiz.find(finalQuery)
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const quizIds = quizzes.map(q => q._id);
    const questionCounts = await Question.aggregate([
      { $match: { quiz: { $in: quizIds } } },
      { $group: { _id: '$quiz', count: { $sum: 1 } } }
    ]);
    const questionCountMap = {};
    questionCounts.forEach(qc => {
      questionCountMap[qc._id.toString()] = qc.count;
    });

    const quizzesWithQuestionCount = quizzes.map(q => {
      const qObj = q.toObject();
      qObj.questionCount = questionCountMap[q._id.toString()] || 0;
      return qObj;
    });

    const total = await Quiz.countDocuments(finalQuery);
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
    const searchQuery = getSearchQuery(req, ['name', 'email', 'phone']);
    searchQuery.role = 'student';

    // Extract and apply optional filters
    const { level } = req.query;

    if (level) searchQuery['level.currentLevel'] = parseInt(level);

    // Check if pagination is requested
    const { page, limit } = req.query;
    
    if (page && limit) {
      // Handle pagination if parameters are provided
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;
      
      const students = await User.find(searchQuery)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      const total = await User.countDocuments(searchQuery);
      const totalPages = Math.ceil(total / limitNum);

      return res.json({
        students,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      });
    } else {
      // Return all students without pagination
      const students = await User.find(searchQuery)
        .select('-password')
        .sort({ createdAt: -1 });

      res.json({
        students
      });
    }
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

// ---------------- Contacts -----------------
exports.getContacts = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);
    const searchQuery = getSearchQuery(req, ['name', 'email', 'message']);

    const contacts = await Contact.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Contact.countDocuments(searchQuery);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      contacts,
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
    console.error('Error fetching contacts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch contacts.' });
  }
};
exports.updateContact = async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    contact.name = name || contact.name;
    contact.email = email || contact.email;
    contact.message = message || contact.message;

    await contact.save();

    res.json({ success: true, message: '📬 Contact updated successfully!', contact });
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ success: false, message: 'Failed to update contact' });
  }
};
exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await contact.remove();

    res.json({ success: true, message: '🗑️ Contact deleted successfully!' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ success: false, message: 'Failed to delete contact' });
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

// Get all bank details with pagination
exports.getBankDetails = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);
    const searchQuery = getSearchQuery(req, ['accountHolderName', 'bankName', 'ifscCode']);
    
    const bankDetails = await BankDetail.find(searchQuery)
      .populate('user', 'name email phone level subscriptionStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await BankDetail.countDocuments(searchQuery);
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      bankDetails,
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
    console.error('Error getting bank details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch bank details.', 
      error: error.message 
    });
  }
};

// ===== PAYMENT TRANSACTIONS =====

// Get all payment transactions with pagination and filtering
exports.getPaymentTransactions = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);
    const { year, month, status, plan, search, sortField = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Build filter query
    const filterQuery = {};
    
    // Date filtering - Default to current year
    const currentYear = year ? parseInt(year) : new Date().getFullYear();
    const startYear = new Date(currentYear, 0, 1);
    const endYear = new Date(currentYear + 1, 0, 1);
    filterQuery.createdAt = { $gte: startYear, $lt: endYear };
    
    // Month filtering - if month is selected, filter by that month
    if (month && month !== '0') {
      const startMonth = new Date(currentYear, parseInt(month) - 1, 1);
      const endMonth = new Date(currentYear, parseInt(month), 1);
      filterQuery.createdAt = { $gte: startMonth, $lt: endMonth };
    }
    
    // Status filtering - only fetch successful PayU transactions
    if (status && status !== 'all') {
      filterQuery.payuStatus = status;
    } else {
      // Default to only successful transactions
      filterQuery.payuStatus = 'success';
    }
    
    // Plan filtering
    if (plan && plan !== 'all') {
      filterQuery.planId = plan.toLowerCase();
    }
    
    // Search filtering
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filterQuery.$or = [
        { orderId: searchRegex },
        { receipt: searchRegex }
      ];
    }
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortField] = sortOrder === 'asc' ? 1 : -1;
    
    const transactions = await PaymentOrder.find(filterQuery)
      .populate('user', 'name email phone')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);
    
    const total = await PaymentOrder.countDocuments(filterQuery);
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: page,
          totalPages,
          total: total,
          limit: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error getting payment transactions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch payment transactions.', 
      error: error.message 
    });
  }
};

// Get payment transaction filter options
exports.getPaymentTransactionFilterOptions = async (req, res) => {
  try {
    // Get available years
    const years = await PaymentOrder.distinct('createdAt', {})
      .then(dates => [...new Set(dates.map(date => new Date(date).getFullYear()))])
      .then(years => years.sort((a, b) => b - a));
    
    // Get available months
    const months = Array.from({length: 12}, (_, i) => i + 1);
    
    // Get available plans
    const plans = await PaymentOrder.distinct('planId');
    
    // Get available payuStatus values - only return success status
    const payuStatuses = ['success']; // Only show successful transactions
    
    res.json({
      success: true,
      data: {
        years,
        months,
        plans: plans.filter(plan => plan).map(plan => plan.charAt(0).toUpperCase() + plan.slice(1)),
        statuses: payuStatuses.map(status => status.charAt(0).toUpperCase() + status.slice(1))
      }
    });
  } catch (error) {
    console.error('Error getting payment transaction filter options:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch filter options.', 
      error: error.message 
    });
  }
};

// Get payment transaction summary
exports.getPaymentTransactionSummary = async (req, res) => {
  try {
    const { year, month } = req.query;
    
    // Build filter query - only include successful PayU transactions
    const filterQuery = {
      payuStatus: 'success' // Only count successful transactions
    };
    
    if (year) {
      const startYear = new Date(parseInt(year), 0, 1);
      const endYear = new Date(parseInt(year) + 1, 0, 1);
      filterQuery.createdAt = { $gte: startYear, $lt: endYear };
    }
    
    if (month && month !== '0') {
      const currentYear = year ? parseInt(year) : new Date().getFullYear();
      const startMonth = new Date(currentYear, parseInt(month) - 1, 1);
      const endMonth = new Date(currentYear, parseInt(month), 1);
      filterQuery.createdAt = { $gte: startMonth, $lt: endMonth };
    }
    
    // Get summary statistics
    const summary = await PaymentOrder.aggregate([
      { $match: filterQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          activeUsers: { $addToSet: '$user' },
          completedTransactions: { $sum: 1 } // All transactions are successful since we filtered by payuStatus: 'success'
        }
      }
    ]);
    
    const result = summary[0] || {
      totalRevenue: 0,
      totalTransactions: 0,
      activeUsers: [],
      completedTransactions: 0
    };
    
    res.json({
      success: true,
      data: {
        totalRevenue: result.totalRevenue,
        periodRevenue: result.totalRevenue,
        totalTransactions: result.totalTransactions,
        activeUsers: result.activeUsers.length,
        completedTransactions: result.completedTransactions
      }
    });
  } catch (error) {
    console.error('Error getting payment transaction summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch summary.', 
      error: error.message 
    });
  }
};

// ===== SUBSCRIPTIONS =====

// Get all user subscriptions with pagination and filtering
exports.getSubscriptions = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);
    const { year, month, status, plan, search, sortField = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Build filter query
    const filterQuery = {};
    
    // Date filtering - Default to current year
    const currentYear = year ? parseInt(year) : new Date().getFullYear();
    const startYear = new Date(currentYear, 0, 1);
    const endYear = new Date(currentYear + 1, 0, 1);
    filterQuery.createdAt = { $gte: startYear, $lt: endYear };
    
    // Month filtering - if month is selected, filter by that month
    if (month && month !== '0') {
      const startMonth = new Date(currentYear, parseInt(month) - 1, 1);
      const endMonth = new Date(currentYear, parseInt(month), 1);
      filterQuery.createdAt = { $gte: startMonth, $lt: endMonth };
    }
    
    // Status filtering
    if (status && status !== 'all') {
      if (status === 'active') {
        // Show all users with future expiry dates (including free users)
        filterQuery.subscriptionExpiry = { $exists: true, $ne: null, $gt: new Date() };
      } else if (status === 'inactive') {
        // Show users without future expiry dates
        filterQuery.$or = [
          { subscriptionExpiry: { $exists: false } },
          { subscriptionExpiry: null },
          { subscriptionExpiry: { $lte: new Date() } }
        ];
      } else if (status === 'expired') {
        filterQuery.subscriptionExpiry = { $lte: new Date() };
      }
    }
    
    // Plan filtering
    if (plan && plan !== 'all') {
      filterQuery.subscriptionStatus = plan.toLowerCase();
    }
    
    // Search filtering
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filterQuery.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortField] = sortOrder === 'asc' ? 1 : -1;
    
    const users = await User.find(filterQuery)
      .select('name email phone subscriptionStatus subscriptionExpiry createdAt')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);
    
    // Transform users to subscription format
    const subscriptions = users.map(user => ({
      _id: user._id,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      planName: user.subscriptionStatus ? user.subscriptionStatus.charAt(0).toUpperCase() + user.subscriptionStatus.slice(1) : 'Free',
      status: user.subscriptionStatus && user.subscriptionStatus !== 'free' && user.subscriptionExpiry && new Date() < new Date(user.subscriptionExpiry) ? 'active' : 'inactive',
      startDate: user.createdAt,
      expiryDate: user.subscriptionExpiry,
      amount: user.subscriptionStatus === 'basic' ? 9 : user.subscriptionStatus === 'premium' ? 49 : user.subscriptionStatus === 'pro' ? 99 : 0,
      paymentMethod: 'payu' // Default for now
    }));
    
    const total = await User.countDocuments(filterQuery);
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          currentPage: page,
          totalPages,
          total: total,
          limit: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch subscriptions.', 
      error: error.message 
    });
  }
};

// Get subscription filter options
exports.getSubscriptionFilterOptions = async (req, res) => {
  try {
    // Get available years
    const years = await User.distinct('createdAt', {})
      .then(dates => [...new Set(dates.map(date => new Date(date).getFullYear()))])
      .then(years => years.sort((a, b) => b - a));
    
    // Get available months
    const months = Array.from({length: 12}, (_, i) => i + 1);
    
    // Get available plans
    const plans = await User.distinct('subscriptionStatus');
    
    res.json({
      success: true,
      data: {
        years,
        months,
        plans: plans.filter(plan => plan).map(plan => plan.charAt(0).toUpperCase() + plan.slice(1))
      }
    });
  } catch (error) {
    console.error('Error getting subscription filter options:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch filter options.', 
      error: error.message 
    });
  }
};

// Get subscription summary
exports.getSubscriptionSummary = async (req, res) => {
  try {
    const { year, month } = req.query;
    
    // Build filter query
    const filterQuery = {};
    
    if (year) {
      const startYear = new Date(parseInt(year), 0, 1);
      const endYear = new Date(parseInt(year) + 1, 0, 1);
      filterQuery.createdAt = { $gte: startYear, $lt: endYear };
    }
    
    if (month && month !== '0') {
      const currentYear = year ? parseInt(year) : new Date().getFullYear();
      const startMonth = new Date(currentYear, parseInt(month) - 1, 1);
      const endMonth = new Date(currentYear, parseInt(month), 1);
      filterQuery.createdAt = { $gte: startMonth, $lt: endMonth };
    }
    
    // Get total subscriptions (all users, no date filter)
    const totalSubscriptions = await User.countDocuments({});
    
    // Get active subscriptions (all users with future expiry dates, no date filter)
    const activeSubscriptions = await User.countDocuments({
      subscriptionExpiry: { $exists: true, $ne: null, $gt: new Date() }
    });
    
    // Get free and paid subscription counts (without date filter)
    const freeSubscriptions = await User.countDocuments({
      subscriptionStatus: 'free'
    });
    const paidSubscriptions = await User.countDocuments({
      subscriptionStatus: { $nin: ['free'] }
    });
    
    // Debug logging for subscription summary
    // console.log('📊 Subscription Summary:', JSON.stringify({
    //   totalSubscriptions,
    //   activeSubscriptions,
    //   freeSubscriptions,
    //   paidSubscriptions,
    //   filterQuery
    // }, null, 2));
    
    // Debug: Check all users with their subscription status
    const allUsers = await User.find({}).select('name subscriptionStatus subscriptionExpiry');
    const userStatuses = allUsers.map(user => ({
      name: user.name,
      status: user.subscriptionStatus,
      expiry: user.subscriptionExpiry,
      isActive: user.subscriptionStatus && user.subscriptionStatus !== 'free' && user.subscriptionExpiry && new Date() < new Date(user.subscriptionExpiry)
    }));
    // console.log('🔍 All Users Subscription Status:', JSON.stringify(userStatuses, null, 2));
    
    // Debug: Count all users by subscription status
    const allFreeUsers = await User.countDocuments({ subscriptionStatus: 'free' });
    const allBasicUsers = await User.countDocuments({ subscriptionStatus: 'basic' });
    const allPremiumUsers = await User.countDocuments({ subscriptionStatus: 'premium' });
    const allProUsers = await User.countDocuments({ subscriptionStatus: 'pro' });
    const allNullUsers = await User.countDocuments({ subscriptionStatus: null });
    
    // console.log('🔍 All Users Count by Status:', JSON.stringify({
    //   free: allFreeUsers,
    //   basic: allBasicUsers,
    //   premium: allPremiumUsers,
    //   pro: allProUsers,
    //   null: allNullUsers,
    //   total: allFreeUsers + allBasicUsers + allPremiumUsers + allProUsers + allNullUsers
    // }, null, 2));
    
    // Get revenue from payment orders
    const revenueQuery = {};
    if (year) {
      const startYear = new Date(parseInt(year), 0, 1);
      const endYear = new Date(parseInt(year) + 1, 0, 1);
      revenueQuery.createdAt = { $gte: startYear, $lt: endYear };
    }
    
    if (month && month !== '0') {
      const currentYear = year ? parseInt(year) : new Date().getFullYear();
      const startMonth = new Date(currentYear, parseInt(month) - 1, 1);
      const endMonth = new Date(currentYear, parseInt(month), 1);
      revenueQuery.createdAt = { $gte: startMonth, $lt: endMonth };
    }
    
    const revenueSummary = await PaymentOrder.aggregate([
      { $match: { ...revenueQuery, payuStatus: 'success' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          periodRevenue: { $sum: '$amount' }
        }
      }
    ]);
    
    const result = revenueSummary[0] || { totalRevenue: 0, periodRevenue: 0 };
    
    const responseData = {
      totalSubscriptions,
      activeSubscriptions,
      freeSubscriptions,
      paidSubscriptions,
      totalRevenue: result.totalRevenue,
      periodRevenue: result.periodRevenue
    };
    
    // console.log('📤 API Response Data:', JSON.stringify(responseData, null, 2));
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error getting subscription summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch summary.', 
      error: error.message 
    });
  }
};


// Get all articles with pagination and filtering (canonical)
exports.getArticles = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);
    const searchQuery = getSearchQuery(req, ['title', 'content', 'tags']);
    const filterQuery = getFilterQuizQuery(req, [
      'status',
      'category',
      'isFeatured',
      'isPinned'
    ]);

    const finalQuery = { ...searchQuery, ...filterQuery };

    const articles = await Article.find(finalQuery)
      .populate('author', 'name email')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Article.countDocuments(finalQuery);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      articles,
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
    console.error('Error getting articles:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch articles.', 
      error: error.message 
    });
  }
};

// Get single article by ID (canonical)
exports.getArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate('author', 'name email')
      .populate('category', 'name');

    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: 'Article not found' 
      });
    }

    res.json({
      success: true,
      article
    });
  } catch (error) {
    console.error('Error getting article:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch article.', 
      error: error.message 
    });
  }
};

// Create new article (canonical)
exports.createArticle = async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      category,
      tags,
      featuredImage,
      featuredImageAlt,
      metaTitle,
      metaDescription,
      isFeatured,
      isPinned,
      status,
      slug
    } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, content, and category are required' 
      });
    }

    // Get author from authenticated user
    const author = req.user.id;

    const article = new Article({
      title,
      slug,
      content,
      excerpt,
      author,
      category,
      tags: tags || [],
      featuredImage,
      featuredImageAlt,
      metaTitle,
      metaDescription,
      isFeatured: isFeatured || false,
      isPinned: isPinned || false,
      status: status || 'draft'
    });

    await article.save();
    await article.populate('author', 'name email');
    await article.populate('category', 'name');

    res.status(201).json({
      success: true,
      message: "🎉 Article Created Successfully!",
      article
    });
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create article.', 
      error: error.message 
    });
  }
};

// Update article (canonical)
exports.updateArticle = async (req, res) => {
  try {
    const {
      title,
      slug,
      content,
      excerpt,
      category,
      tags,
      featuredImage,
      featuredImageAlt,
      metaTitle,
      metaDescription,
      isFeatured,
      isPinned,
      status
    } = req.body;

    const updateData = {
      title,
      slug,
      content,
      excerpt,
      category,
      tags,
      featuredImage,
      featuredImageAlt,
      metaTitle,
      metaDescription,
      isFeatured,
      isPinned,
      status
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const article = await Article.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    )
      .populate('author', 'name email')
      .populate('category', 'name');

    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: 'Article not found' 
      });
    }

    res.json({
      success: true,
      message: "🎉 Article Updated Successfully!",
      article
    });
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update article.', 
      error: error.message 
    });
  }
};

// Delete article (canonical)
exports.deleteArticle = async (req, res) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);

    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: 'Article not found' 
      });
    }

    res.json({
      success: true,
      message: '🗑️ Article deleted successfully!'
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete article.', 
      error: error.message 
    });
  }
};

// Publish article (canonical)
exports.publishArticle = async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'published',
        publishedAt: new Date()
      },
      { new: true }
    )
      .populate('author', 'name email')
      .populate('category', 'name');

    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: 'Article not found' 
      });
    }

    res.json({
      success: true,
      message: "🚀 Article Published Successfully!",
      article
    });
  } catch (error) {
    console.error('Error publishing article:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to publish article.', 
      error: error.message 
    });
  }
};

// Unpublish article (canonical)
exports.unpublishArticle = async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { status: 'draft' },
      { new: true }
    )
      .populate('author', 'name email')
      .populate('category', 'name');

    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: 'Article not found' 
      });
    }

    res.json({
      success: true,
      message: "📝 Article Unpublished Successfully!",
      article
    });
  } catch (error) {
    console.error('Error unpublishing article:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to unpublish article.', 
      error: error.message 
    });
  }
};

// Toggle featured status (canonical)
exports.toggleFeatured = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: 'Article not found' 
      });
    }

    article.isFeatured = !article.isFeatured;
    await article.save();
    await article.populate('author', 'name email');
    await article.populate('category', 'name');

    res.json({
      success: true,
      message: article.isFeatured ? "⭐ Article Featured!" : "⭐ Article Unfeatured!",
      article
    });
  } catch (error) {
    console.error('Error toggling featured status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to toggle featured status.', 
      error: error.message 
    });
  }
};

// Toggle pinned status (canonical)
exports.togglePinned = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({ 
        success: false, 
        message: 'Article not found' 
      });
    }

    article.isPinned = !article.isPinned;
    await article.save();
    await article.populate('author', 'name email');
    await article.populate('category', 'name');

    res.json({
      success: true,
      message: article.isPinned ? "📌 Article Pinned!" : "📌 Article Unpinned!",
      article
    });
  } catch (error) {
    console.error('Error toggling pinned status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to toggle pinned status.', 
      error: error.message 
    });
  }
};

// Get article statistics (canonical)
exports.getArticleStats = async (req, res) => {
  try {
    const totalArticles = await Article.countDocuments();
    const publishedArticles = await Article.countDocuments({ status: 'published' });
    const draftArticles = await Article.countDocuments({ status: 'draft' });
    const archivedArticles = await Article.countDocuments({ status: 'archived' });
    const featuredArticles = await Article.countDocuments({ isFeatured: true });
    const pinnedArticles = await Article.countDocuments({ isPinned: true });

    // Get total views and likes
    const stats = await Article.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' },
          totalLikes: { $sum: '$likes' }
        }
      }
    ]);

    const totalViews = stats[0]?.totalViews || 0;
    const totalLikes = stats[0]?.totalLikes || 0;

    res.json({
      success: true,
      stats: {
        totalArticles,
        publishedArticles,
        draftArticles,
        archivedArticles,
        featuredArticles,
        pinnedArticles,
        totalViews,
        totalLikes
      }
    });
  } catch (error) {
    console.error('Error getting article stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch article statistics.', 
      error: error.message 
    });
  }
};
