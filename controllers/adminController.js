const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const User = require('../models/User');
const LiveQuiz = require('../models/LiveQuiz');
const { generateQuestions } = require('../utils/openai');

exports.getStats = async (req, res) => {
  const categories = await Category.countDocuments();
  const subcategories = await Subcategory.countDocuments();
  const quizzes = await Quiz.countDocuments();
  const questions = await Question.countDocuments();
  const students = await User.countDocuments({ role: 'student' });
  res.json({ categories, subcategories, quizzes, questions, students });
};

// ---------------- Category ----------------
exports.getCategories = async (req, res) => {
  const categories = await Category.find();
  res.json(categories);
};

exports.createCategory = async (req, res) => {
  const { name, description } = req.body;
  const category = new Category({ name, description });
  await category.save();
  res.status(201).json({message: "🎉 Category Created Successfully!", category: category});
};

exports.updateCategory = async (req, res) => {
  const { name, description } = req.body;
  const category = await Category.findByIdAndUpdate(req.params.id, { name, description }, { new: true });
  if (!category) return res.status(404).json({ message: 'Category not found' });
  res.json(category);
};

exports.deleteCategory = async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found' });
  res.json({ message: 'Category deleted' });
};

// ---------------- Subcategory ----------------
exports.getSubcategories = async (req, res) => {
  const subs = await Subcategory.find().populate('category', 'name');
  res.json(subs);
};

exports.createSubcategory = async (req, res) => {
  const { name, category } = req.body;
  const subcategory = new Subcategory({ name, category });
  await subcategory.save();
  res.status(201).json(subcategory);
};

exports.updateSubcategory = async (req, res) => {
  const { name, category } = req.body;
  const subcategory = await Subcategory.findByIdAndUpdate(req.params.id, { name, category }, { new: true });
  if (!subcategory) return res.status(404).json({ message: 'Subcategory not found' });
  res.json(subcategory);
};

exports.deleteSubcategory = async (req, res) => {
  const subcategory = await Subcategory.findByIdAndDelete(req.params.id);
  if (!subcategory) return res.status(404).json({ message: 'Subcategory not found' });
  res.json({ message: 'Subcategory deleted' });
};

// ---------------- Quiz ----------------
exports.getQuizzes = async (req, res) => {
  const quizzes = await Quiz.find()
    .populate('category', 'name')
    .populate('subcategory', 'name');
  res.json(quizzes);
};

exports.createQuiz = async (req, res) => {
  const { title, category, subcategory, totalMarks, timeLimit } = req.body;
  const quiz = new Quiz({ title, category, subcategory, totalMarks, timeLimit });
  await quiz.save();
  res.status(201).json(quiz);
};

exports.createOPENAIQuiz = async (req, res) => {
  try {
    const { title, category, subcategory, totalMarks, timeLimit, numQuestions = 5 } = req.body;

    // 1. Create quiz entry
    const quiz = new Quiz({ title, category, subcategory, totalMarks, timeLimit });
    await quiz.save();

    // 2. Generate questions using OpenAI
    const questions = await generateQuestions(title, numQuestions);

    // 3. Map and save questions
    const questionDocs = questions.map(q => ({
      quiz: quiz._id,
      questionText: q.questionText,
      options: q.options,
      correctAnswerIndex: q.correctAnswerIndex
    }));

    await Question.insertMany(questionDocs);

    res.status(201).json({
      message: 'Quiz and AI-generated questions created successfully',
      quizId: quiz._id,
      totalQuestions: questionDocs.length
    });
  } catch (err) {
    console.error("Error creating AI quiz:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateQuiz = async (req, res) => {
  const { title, category, subcategory, totalMarks, timeLimit } = req.body;
  const quiz = await Quiz.findByIdAndUpdate(req.params.id, { title, category, subcategory, totalMarks, timeLimit }, { new: true });
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
  res.json(quiz);
};

exports.deleteQuiz = async (req, res) => {
  const quiz = await Quiz.findByIdAndDelete(req.params.id);
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
  res.json({ message: 'Quiz deleted' });
};

// ---------------- Question ----------------
exports.getQuestions = async (req, res) => {
  const questions = await Question.find().populate('quiz', 'title');
  res.json(questions);
};

exports.createQuestion = async (req, res) => {
  const { quiz, questionText, options, correctAnswerIndex, timeLimit } = req.body;
  const question = new Question({ quiz, questionText, options, correctAnswerIndex, timeLimit });
  await question.save();
  res.status(201).json(question);
};

exports.updateQuestion = async (req, res) => {
  const { quiz, questionText, options, correctAnswerIndex, timeLimit } = req.body;
  const question = await Question.findByIdAndUpdate(
    req.params.id,
    { quiz, questionText, options, correctAnswerIndex, timeLimit },
    { new: true }
  );
  if (!question) return res.status(404).json({ message: 'Question not found' });
  res.json(question);
};

exports.deleteQuestion = async (req, res) => {
  const question = await Question.findByIdAndDelete(req.params.id);
  if (!question) return res.status(404).json({ message: 'Question not found' });
  res.json({ message: 'Question deleted' });
};

// ---------------- Students ----------------
exports.getStudents = async (req, res) => {
  const students = await User.find({ role: 'student' }).select('-password');
  res.json(students);
};

exports.updateStudent = async (req, res) => {
  const { name, email, phone } = req.body;
  const student = await User.findById(req.params.id);
  if (!student || student.role !== 'student') return res.status(404).json({ message: 'Student not found' });
  student.name = name || student.name;
  student.email = email || student.email;
  student.phone = phone || student.phone;
  await student.save();
  res.json(student);
};

exports.deleteStudent = async (req, res) => {
  const student = await User.findById(req.params.id);
  if (!student || student.role !== 'student') return res.status(404).json({ message: 'Student not found' });
  await student.remove();
  res.json({ message: 'Student deleted' });
};

exports.assignBadge = async (req, res) => {
  const { studentId, badge } = req.body;
  if (!studentId || !badge) return res.status(400).json({ error: 'Student ID and badge required' });
  const student = await User.findById(studentId);
  if (!student || student.role !== 'student') return res.status(404).json({ error: 'Student not found' });
  if (student.badges.includes(badge)) return res.status(400).json({ error: 'Badge already assigned' });
  student.badges.push(badge);
  await student.save();
  res.json({ message: 'Badge assigned', badges: student.badges });
};

exports.createLiveQuiz = async (req, res) => {
  try {
    const { quizId, isPro, coinsToPlay, startTime, endTime } = req.body;

    if (!quizId) return res.status(400).json({ error: 'quizId is required' });

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const liveQuiz = await LiveQuiz.create({
      quiz: quizId,
      host: req.user.id,
      status: 'not_started',
      currentQuestionIndex: 0,
      accessType: isPro ? 'pro' : 'free',
      coinsToPlay: coinsToPlay || 0,
      startTime: startTime,
      endTime: endTime,
    });
    res.status(201).json({ message: "🎉 Live Quiz Created Successfully!", liveQuiz: liveQuiz });
  } catch (err) {
    console.error('Error creating live quiz:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.startLiveQuiz = async (req, res) => {
  try {
    console.log(req.params.id, 'req.params.id')
    const liveQuiz = await LiveQuiz.findById(req.params.id);
    
    if (!liveQuiz) return res.status(404).json({ error: 'Live quiz not found' });

    if (liveQuiz.status === 'started') {
      return res.status(400).json({ message: 'Quiz is already started' });
    }

    liveQuiz.status = 'started';
    liveQuiz.startTime = new Date();
    liveQuiz.currentQuestionIndex = 0;

    await liveQuiz.save();

    res.json({ message: '🎉 Live Quiz Started Successfully!', quizId: liveQuiz._id });
  } catch (err) {
    console.error('Error starting live quiz:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


exports.endLiveQuiz = async (req, res) => {
  try {
    const liveQuiz = await LiveQuiz.findById(req.params.id);
    if (!liveQuiz) return res.status(404).json({ error: 'Live quiz not found' });

    if (liveQuiz.status === 'ended') {
      return res.status(400).json({ message: 'Quiz is already ended' });
    }

    liveQuiz.status = 'ended';
    liveQuiz.endTime = new Date();

    await liveQuiz.save();

    res.json({ message: '🎉 Live Quiz Ended Successfully!', quizId: liveQuiz._id });
  } catch (err) {
    console.error('Error ending live quiz:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


