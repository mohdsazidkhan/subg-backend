// controllers/quizController.js
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');

exports.attemptQuiz = async (req, res) => {
  try {
    const quizId = req.params.quizid;
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({ message: 'Unauthorized: No user info found' });
    }

    const { answers } = req.body; // answers: ["option string", ...]

    const questions = await Question.find({ quiz: quizId });

    if (!questions.length) {
      return res.status(404).json({ message: 'No questions found for this quiz' });
    }

    if (!answers || answers.length !== questions.length) {
      return res.status(400).json({ message: 'All questions must be answered' });
    }

    const existingAttempt = await QuizAttempt.findOne({
      student: studentId,
      quiz: quizId,
    });

    if (existingAttempt) {
      return res.status(400).json({ message: 'You have already attempted this quiz.' });
    }

    let score = 0;
    const answerRecords = [];

    questions.forEach((q, i) => {
      // Get the correct answer string from the index
      const correctAnswer = q.options[q.correctAnswerIndex];
      const submittedAnswer = answers[i];
      const isCorrect = submittedAnswer === correctAnswer;

      if (isCorrect) score++;

      answerRecords.push({
        questionId: q._id,
        answer: submittedAnswer,
      });
    });

    const attempt = new QuizAttempt({
      student: studentId,
      quiz: quizId,
      answers: answerRecords,
      score,
    });

    await attempt.save();

    const coinsEarned = score * 10;

    await User.findByIdAndUpdate(studentId, {
      $inc: { coins: coinsEarned },
      ...(score === questions.length ? { $addToSet: { badges: 'Perfect Scorer' } } : {}),
    });

    res.json({
      total: questions.length,
      score,
      correctAnswers: questions.map((q) => q.options[q.correctAnswerIndex]),
      attemptId: attempt._id,
      coinsEarned,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getQuizWithQuestions = async (req, res) => {
  try {
    const quizId = req.params.quizid;

    // Get quiz basic info
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // Get all questions for this quiz
    const questions = await Question.find({ quiz: quizId });

    if (!questions.length) {
      return res.status(404).json({ error: 'No questions found for this quiz' });
    }

    res.json({
      title: quiz.title,
      questions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
