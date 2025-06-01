const LiveQuiz = require('../models/LiveQuiz');
const LiveQuizParticipant = require('../models/LiveQuizParticipant');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');

exports.getAllLiveQuizzes = async (req, res) => {
  try {
    const quizzes = await LiveQuiz.find({}).populate("quiz");
    res.json(quizzes);
  } catch (err) {
    console.error('Error fetching live quizzes:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getLiveQuizzes = async (req, res) => {
  try {
    const liveQuizzes = await LiveQuiz.find({}).populate({
      path: 'quiz',
      populate: [
        { path: 'category', select: 'name' },
        { path: 'subcategory', select: 'name' }
      ]
    });

    const quizzesWithDetails = await Promise.all(
      liveQuizzes.map(async (lq) => {
        
        if (!lq.quiz || !lq.quiz._id) return null;

        const questionCount = await Question.countDocuments({ quiz: lq.quiz._id });
        // Fetch the wallet transactions, populate user to get publicId
const paidOrders = await WalletTransaction.find({ liveQuizId: lq._id, type: 'spend_coins' })
  .populate('user', 'publicId')  // populate 'user' field, only publicId needed

// Extract publicIds from populated users
const paidUsers = paidOrders.map(order => order.user?.publicId).filter(Boolean);

        const quizAttemptsNew = await QuizAttempt.find({ quiz: lq.quiz._id }).populate('student', 'publicId');
        const attemptedUsers = quizAttemptsNew.map(attempt => attempt.student?.publicId);
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
          status: lq.status,
          amount: lq.amount,
          accessType: lq.accessType,
          coinsToPlay: lq.coinsToPlay,
          startTime: lq.startTime,
          endTime: lq.endTime,
          currentQuestionIndex: lq.currentQuestionIndex,
          paidUsers,
          attemptedUsers,
          createdAt: lq.createdAt,
          updatedAt: lq.updatedAt,
        };
      })
    );

    res.json(quizzesWithDetails.filter(q => q !== null));
  } catch (err) {
    console.error('Error fetching active quizzes:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.joinLiveQuiz = async (req, res) => {
  const { quizId } = req.body;
  try {
    const liveQuiz = await LiveQuiz.findById(quizId);
    if (!liveQuiz) return res.status(404).json({ message: 'Live quiz not found' });

    const coinsToPlay = Number(liveQuiz.coinsToPlay);
    if (isNaN(coinsToPlay)) return res.status(400).json({ message: 'Invalid coins value' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const alreadyJoined = await LiveQuizParticipant.findOne({ liveQuiz: quizId, user: req.user.id });
    if (alreadyJoined) return res.status(400).json({ message: 'Already joined this quiz' });

    user.coins = user.coins || 0;
    user.balance = user.balance || 0;

    if (user.coins < coinsToPlay) {
      return res.status(400).json({ message: 'Please add coins to your wallet to play this quiz' });
    }

    user.coins -= coinsToPlay;
    user.balance -= coinsToPlay / 10;

    await user.save();

    await WalletTransaction.create({
      user: req.user.id,
      type: 'spend_coins',
      amount: coinsToPlay,
      currency: 'COINS',
      description: `Spent ${coinsToPlay} coins to Join Quiz ${quizId}`,
      liveQuizId: quizId
    });

    res.json({ message: 'Joined Quiz Successfully', payment: true, userCoins: user.coins, userBalance: user.balance });

  } catch (err) {
    console.error('Error joining live quiz:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


