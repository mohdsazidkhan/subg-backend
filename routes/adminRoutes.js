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
router.get('/allquizzes', protect, adminOnly, adminCtrl.getAllAdminQuizzes);
router.post('/quizzes', protect, adminOnly, adminCtrl.createQuiz);
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

// CONTACTS
router.get('/contacts', protect, adminOnly, adminCtrl.getContacts);
router.put('/contacts/:id', protect, adminOnly, adminCtrl.updateContact);
router.delete('/contacts/:id', protect, adminOnly, adminCtrl.deleteContact);

// BADGES
router.post('/assign-badge', protect, adminOnly, adminCtrl.assignBadge);

// BANK DETAILS
router.get('/bank-details', protect, adminOnly, adminCtrl.getBankDetails);

// MIGRATION
router.post('/migrate-users-to-free', protect, adminOnly, adminCtrl.migrateUsersToFree);

module.exports = router;
