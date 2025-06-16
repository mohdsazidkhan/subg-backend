const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const adminCtrl = require('../controllers/adminController');

// STATS
router.get('/stats', protect, adminOnly, adminCtrl.getStats);

// CATEGORY
router.get('/categories', protect, adminOnly, adminCtrl.getCategories);
router.post('/categories', protect, adminOnly, adminCtrl.createCategory);
router.put('/categories/:id', protect, adminOnly, adminCtrl.updateCategory);
router.delete('/categories/:id', protect, adminOnly, adminCtrl.deleteCategory);

// SUBCATEGORY
router.get('/subcategories', protect, adminOnly, adminCtrl.getSubcategories);
router.post('/subcategories', protect, adminOnly, adminCtrl.createSubcategory);
router.put('/subcategories/:id', protect, adminOnly, adminCtrl.updateSubcategory);
router.delete('/subcategories/:id', protect, adminOnly, adminCtrl.deleteSubcategory);

// QUIZ
router.get('/quizzes', protect, adminOnly, adminCtrl.getQuizzes);
router.post('/quizzes', protect, adminOnly, adminCtrl.createQuiz);
router.post('/quizzes/ai', protect, adminOnly, adminCtrl.createOPENAIQuiz);
router.put('/quizzes/:id', protect, adminOnly, adminCtrl.updateQuiz);
router.delete('/quizzes/:id', protect, adminOnly, adminCtrl.deleteQuiz);

// QUESTION
router.get('/questions', protect, adminOnly, adminCtrl.getQuestions);
router.post('/questions', protect, adminOnly, adminCtrl.createQuestion);
router.put('/questions/:id', protect, adminOnly, adminCtrl.updateQuestion);
router.delete('/questions/:id', protect, adminOnly, adminCtrl.deleteQuestion);

// STUDENT
router.get('/students', protect, adminOnly, adminCtrl.getStudents);
router.put('/students/:id', protect, adminOnly, adminCtrl.updateStudent);
router.delete('/students/:id', protect, adminOnly, adminCtrl.deleteStudent);

// BADGES
router.post('/assign-badge', protect, adminOnly, adminCtrl.assignBadge);

router.post('/live-quiz/create', protect, adminOnly, adminCtrl.createLiveQuiz);
router.patch('/live-quiz/start/:id', protect, adminOnly, adminCtrl.startLiveQuiz);
router.patch('/live-quiz/end/:id', protect, adminOnly, adminCtrl.endLiveQuiz);

module.exports = router;
