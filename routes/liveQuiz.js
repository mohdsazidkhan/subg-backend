const express = require('express');
const router = express.Router();
const LiveQuiz = require('../models/LiveQuiz');
const Quiz = require('../models/Quiz');
const { protect, adminOnly } = require('../middleware/auth');
const Question = require('../models/Question');

// ✅ Create a live quiz
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { quizId } = req.body;

    if (!quizId) return res.status(400).json({ error: 'quizId is required' });

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const liveQuiz = await LiveQuiz.create({
      quiz: quizId,
      host: req.user.id,
      isActive: false,
      participants: [],
      currentQuestionIndex: 0,
    });

    res.status(201).json(liveQuiz);
  } catch (err) {
    console.error('Error creating live quiz:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/all', async (req, res) => {
  try {
    const quizzes = await LiveQuiz.find({}).populate("quiz");
    res.json(quizzes);
  } catch (err) {
    console.error('Error fetching live quizzes:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/active', async (req, res) => {
  try {
    const liveQuizzes = await LiveQuiz.find({ isActive: true })
      .populate({
        path: 'quiz',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subcategory', select: 'name' },
        ],
      });
      
    const quizzesWithDetails = await Promise.all(
      liveQuizzes.map(async (lq) => {
        if (!lq.quiz || !lq.quiz._id) {
          console.warn('Quiz not populated for liveQuiz:', lq.quiz._id);
          return null;
        }

        const questionCount = await Question.countDocuments({ quiz: lq.quiz._id });

        return {
          _id: lq._id,
          quiz: {
            _id: lq.quiz._id,
            title: lq.quiz.title,
            totalMarks: lq.quiz.totalMarks,
            timeLimit: lq.quiz.timeLimit,
            category: lq.quiz.category,
            subcategory: lq.quiz.subcategory,
            totalQuestions: questionCount,
          },
          host: lq.host,
          isActive: lq.isActive,
          currentQuestionIndex: lq.currentQuestionIndex,
          participants: lq.participants,
          createdAt: lq.createdAt,
          updatedAt: lq.updatedAt,
        };
      })
    );

    // Filter out nulls if any quiz was missing
    res.json(quizzesWithDetails.filter(q => q !== null));
  } catch (err) {
    console.error('Error fetching live quizzes:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ✅ Join a live quiz
router.post('/:id/join', protect, async (req, res) => {
  try {
    const liveQuiz = await LiveQuiz.findById(req.params.id);
    if (!liveQuiz) return res.status(404).json({ error: 'Live quiz not found' });

    const alreadyJoined = liveQuiz.participants.some(
      p => p.user.toString() === req.user._id.toString()
    );
    if (alreadyJoined) {
      return res.status(400).json({ error: 'Already joined this quiz' });
    }

    liveQuiz.participants.push({ user: req.user._id });
    await liveQuiz.save();

    res.json({ message: 'Joined quiz successfully' });
  } catch (err) {
    console.error('Error joining live quiz:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Start a live quiz
router.post('/:id/start', protect, adminOnly, async (req, res) => {
  try {
    const liveQuiz = await LiveQuiz.findById(req.params.id);
    if (!liveQuiz) return res.status(404).json({ error: 'Live quiz not found' });

    liveQuiz.isActive = true;
    liveQuiz.currentQuestionIndex = 0;
    await liveQuiz.save();

    res.json({ message: 'Live quiz started' });
  } catch (err) {
    console.error('Error starting live quiz:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ End a live quiz
router.post('/:id/end', protect, adminOnly, async (req, res) => {
  try {
    const liveQuiz = await LiveQuiz.findById(req.params.id);
    if (!liveQuiz) return res.status(404).json({ error: 'Live quiz not found' });

    liveQuiz.isActive = false;
    await liveQuiz.save();

    res.json({ message: 'Live quiz ended' });
  } catch (err) {
    console.error('Error ending live quiz:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
