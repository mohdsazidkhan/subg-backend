const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const User = require('../models/User');


router.get('/stats', protect, adminOnly, async (req, res) => {
  const categories = await Category.countDocuments();
  const subcategories = await Subcategory.countDocuments();
  const quizzes = await Quiz.countDocuments();
  const questions = await Question.countDocuments();
  const students = await User.countDocuments({ role: 'student' });

  res.json({ categories, subcategories, quizzes, questions, students });
});

// --------------------
// CATEGORY ROUTES
// --------------------

// GET all categories
router.get('/categories', protect, adminOnly, async (req, res) => {
  const categories = await Category.find();
  res.json(categories);
});

// CREATE category
router.post('/categories', protect, adminOnly, async (req, res) => {
  const { name, description } = req.body;
  const category = new Category({ name, description });
  await category.save();
  res.status(201).json(category);
});

// UPDATE category by id
router.put('/categories/:id', protect, adminOnly, async (req, res) => {
  const { name, description } = req.body;
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { name, description },
    { new: true }
  );
  if (!category) return res.status(404).json({ message: 'Category not found' });
  res.json(category);
});

// DELETE category by id
router.delete('/categories/:id', protect, adminOnly, async (req, res) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found' });
  res.json({ message: 'Category deleted' });
});

// --------------------
// SUBCATEGORY ROUTES
// --------------------

// GET all subcategories
router.get('/subcategories', protect, adminOnly, async (req, res) => {
  const subs = await Subcategory.find().populate('category', 'name');
  res.json(subs);
});

// CREATE subcategory
router.post('/subcategories', protect, adminOnly, async (req, res) => {
  const { name, category } = req.body; // category = categoryId
  const subcategory = new Subcategory({ name, category });
  await subcategory.save();
  res.status(201).json(subcategory);
});

// UPDATE subcategory by id
router.put('/subcategories/:id', protect, adminOnly, async (req, res) => {
  const { name, category } = req.body;
  const subcategory = await Subcategory.findByIdAndUpdate(
    req.params.id,
    { name, category },
    { new: true }
  );
  if (!subcategory) return res.status(404).json({ message: 'Subcategory not found' });
  res.json(subcategory);
});

// DELETE subcategory by id
router.delete('/subcategories/:id', protect, adminOnly, async (req, res) => {
  const subcategory = await Subcategory.findByIdAndDelete(req.params.id);
  if (!subcategory) return res.status(404).json({ message: 'Subcategory not found' });
  res.json({ message: 'Subcategory deleted' });
});

// --------------------
// QUIZ ROUTES
// --------------------

// GET all quizzes
router.get('/quizzes', protect, adminOnly, async (req, res) => {
  const quizzes = await Quiz.find()
    .populate('category', 'name')
    .populate('subcategory', 'name');
  res.json(quizzes);
});

// CREATE quiz
router.post('/quizzes', protect, adminOnly, async (req, res) => {
  const { title, category, subcategory, totalMarks, timeLimit } = req.body;
  const quiz = new Quiz({ title, category, subcategory, totalMarks, timeLimit });
  await quiz.save();
  res.status(201).json(quiz);
});

// UPDATE quiz by id
router.put('/quizzes/:id', protect, adminOnly, async (req, res) => {
  const { title, category, subcategory, totalMarks, timeLimit } = req.body;
  const quiz = await Quiz.findByIdAndUpdate(
    req.params.id,
    { title, category, subcategory, totalMarks, timeLimit },
    { new: true }
  );
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
  res.json(quiz);
});

// DELETE quiz by id
router.delete('/quizzes/:id', protect, adminOnly, async (req, res) => {
  const quiz = await Quiz.findByIdAndDelete(req.params.id);
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
  res.json({ message: 'Quiz deleted' });
});

// --------------------
// QUESTION ROUTES
// --------------------

// GET all questions
router.get('/questions', protect, adminOnly, async (req, res) => {
  const questions = await Question.find().populate('quiz', 'title');
  res.json(questions);
});

// CREATE question
router.post('/questions', protect, adminOnly, async (req, res) => {
  const { quiz, questionText, options, correctAnswerIndex } = req.body;
  const question = new Question({ quiz, questionText, options, correctAnswerIndex });
  await question.save();
  res.status(201).json(question);
});

// UPDATE question by id
router.put('/questions/:id', protect, adminOnly, async (req, res) => {
  const { quiz, questionText, options, correctAnswer } = req.body;
  const question = await Question.findByIdAndUpdate(
    req.params.id,
    { quiz, questionText, options, correctAnswer },
    { new: true }
  );
  if (!question) return res.status(404).json({ message: 'Question not found' });
  res.json(question);
});

// DELETE question by id
router.delete('/questions/:id', protect, adminOnly, async (req, res) => {
  const question = await Question.findByIdAndDelete(req.params.id);
  if (!question) return res.status(404).json({ message: 'Question not found' });
  res.json({ message: 'Question deleted' });
});

// --------------------
// STUDENT (USER) ROUTES
// --------------------

// GET all students
router.get('/students', protect, adminOnly, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password');
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE student info by id
router.put('/students/:id', protect, adminOnly, async (req, res) => {
  const { name, email, phone } = req.body;
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }
    student.name = name || student.name;
    student.email = email || student.email;
    student.phone = phone || student.phone;
    await student.save();
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE student by id
router.delete('/students/:id', protect, adminOnly, async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }
    await student.remove();
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/assign-badge', async (req, res) => {
  try {
    const { studentId, badge } = req.body;

    if (!studentId || !badge) {
      return res.status(400).json({ error: 'Student ID and badge required' });
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (student.badges.includes(badge)) {
      return res.status(400).json({ error: 'Badge already assigned' });
    }

    student.badges.push(badge);
    await student.save();

    res.json({ message: 'Badge assigned to student', badges: student.badges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
