const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/student');
const liveQuizRoutes = require('./routes/liveQuiz');
const LiveQuiz = require('./models/LiveQuiz');
const Question = require('./models/Question');
const QuizAttempt = require('./models/QuizAttempt');
const User = require('./models/User');
const paymentRoutes = require('./routes/payment');
const LiveQuizParticipant = require('./models/LiveQuizParticipant');
const Leaderboard = require('./models/Leaderboard');
const walletTransactionRoutes = require('./routes/walletTransactionRoutes');


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/live-quizzes', liveQuizRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/wallet', walletTransactionRoutes);


const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://subg-frontend.vercel.app"
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation"), false);
      }
    },
    methods: ["GET", "POST"]
  },
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ['websocket']
});

io.on("connection", (socket) => {
  console.log("Client connected: " + socket.id);

  socket.on("joinRoom", async ({ quizId, userId }) => {
    try {
      const user = await User.findOne({ publicId: userId });
      if (!user) return socket.emit("error", "User not found");
      const userIdDb = user._id;

      const attempt = await QuizAttempt.findOne({ student: userIdDb, quiz: quizId }).populate("student", "name publicId");
      if (attempt) {
        const leaderboardDoc = await Leaderboard.findOne({ liveQuiz: await LiveQuiz.findOne({ quiz: quizId }).select("_id") });

        let leaderboard = [];
        let userRank = 0;

        if (leaderboardDoc) {
          leaderboard = leaderboardDoc.entries.map(entry => ({
            userId: entry.userId.toString(),
            name: entry.name,
            score: entry.score,
            coinsEarned: entry.coinsEarned
          }));

          userRank = leaderboard.findIndex(entry => entry.userId === userIdDb.toString()) + 1;
        }

        return socket.emit("alreadyAttempted", {
          message: "You already attempted this quiz.",
          score: attempt.score,
          coinsEarned: attempt.coinsEarned || 0,
          rank: userRank,
          leaderboard
        });
      }


      socket.join(quizId);
      console.log("User joined room: " + quizId);

      const liveQuiz = await LiveQuiz.findOne({ quiz: quizId }).populate("quiz");
      if (!liveQuiz) return socket.emit("error", "Live quiz not found");

      let participant = await LiveQuizParticipant.findOne({ liveQuiz: liveQuiz._id, user: userIdDb });
      if (!participant) {
        participant = await LiveQuizParticipant.create({
          liveQuiz: liveQuiz._id,
          user: userIdDb,
          score: 0,
          coinsEarned: 0,
          answers: [],
          currentQuestionIndex: 0,
          completed: false
        });
      }

      const questions = await Question.find({ quiz: liveQuiz.quiz._id });
      const question = questions[participant.currentQuestionIndex];

      if (!question) {
        return socket.emit("error", "No questions available");
      }

      socket.emit("question", { question });
    } catch (error) {
      console.error("joinRoom error:", error);
      socket.emit("error", "Something went wrong");
    }
  });

  socket.on("submitAnswer", async ({ quizId, userId, questionId, answer }) => {
    try {
      const user = await User.findOne({ publicId: userId });
      if (!user) return socket.emit("error", "User not found");
      const userIdDb = user._id;

      const liveQuiz = await LiveQuiz.findOne({ quiz: quizId }).populate("quiz");
      if (!liveQuiz) return socket.emit("error", "Live quiz not found");

      const participant = await LiveQuizParticipant.findOne({ liveQuiz: liveQuiz._id, user: userIdDb });
      if (!participant) return socket.emit("error", "Please join the quiz again.");

      const alreadyAnswered = participant.answers.some(a => a.questionId.toString() === questionId);

      if (!alreadyAnswered) {
        participant.answers.push({ questionId, answer });

        const question = await Question.findById(questionId);
        if (question.options[question.correctAnswerIndex] === answer) {
          participant.score += 1;
          participant.coinsEarned = (participant.coinsEarned || 0) + 100;
          await User.findByIdAndUpdate(userIdDb, { $inc: { coins: 100 } });
        }
      }

      participant.currentQuestionIndex += 1;
      const totalQuestions = await Question.countDocuments({ quiz: liveQuiz.quiz._id });

      if (participant.currentQuestionIndex >= totalQuestions) {
        participant.completed = true;
      }

      await participant.save();

      const nextQuestion = await Question.findOne({ quiz: liveQuiz.quiz._id }).skip(participant.currentQuestionIndex);

      if (nextQuestion) {
        socket.emit("question", { question: nextQuestion });
      } else {
        const existingAttempt = await QuizAttempt.findOne({ student: userIdDb, quiz: quizId });
        if (!existingAttempt) {
          await QuizAttempt.create({
            student: userIdDb,
            quiz: quizId,
            score: participant.score,
            coinsEarned: participant.coinsEarned || 0,
            answers: participant.answers,
            attemptedAt: new Date()
          });
        }

        const correctAnswers = participant.score;
        const wrongAnswers = totalQuestions - correctAnswers;

        const answeredQuestionIds = participant.answers.map(a => a.questionId);
        const answeredQuestions = await Question.find({ _id: { $in: answeredQuestionIds } });

        const questionBreakdown = answeredQuestions.map(q => {
          const userAnswer = participant.answers.find(a => a.questionId.toString() === q._id.toString())?.answer;
          const correctAnswer = q.options[q.correctAnswerIndex];
          const isCorrect = userAnswer === correctAnswer;

          return {
            questionText: q.questionText,
            options: q.options,
            userAnswer,
            correctAnswer,
            isCorrect
          };
        });

        socket.emit("quizEnd", {
          message: "You have completed the quiz!",
          totalQuestions,
          correctAnswers,
          wrongAnswers,
          score: correctAnswers,
          coinsEarned: participant.coinsEarned || 0,
          questionBreakdown
        });

        const allParticipants = await LiveQuizParticipant.find({ liveQuiz: liveQuiz._id }).populate("user");
        const allCompleted = allParticipants.every(p => p.completed);

        if (allCompleted) {
          const leaderboardEntries = allParticipants.map(p => ({
            userId: p.user._id,
            name: p.user.name,
            score: p.score,
            coinsEarned: 0
          })).sort((a, b) => b.score - a.score);

          let coinsDistributed = 0;
          let lastScore = null;

          for (let i = 0; i < leaderboardEntries.length; i++) {
            const entry = leaderboardEntries[i];
            const rank = i + 1;
            entry.rank = rank;

            let coinsEarned = 0;

            // Only allow coins to top 5 people (by score, max 5 people total)
            if (coinsDistributed < 5) {
              if (lastScore === null || entry.score !== lastScore || coinsDistributed < 5) {
                coinsEarned = entry.score * 100;
                coinsDistributed++;
                lastScore = entry.score;
              }
            }

            entry.coinsEarned = coinsEarned;

            await LiveQuizParticipant.findOneAndUpdate(
              { liveQuiz: liveQuiz._id, user: entry.userId },
              { rank, coinsEarned }
            );

            if (coinsEarned > 0) {
              await User.findByIdAndUpdate(entry.userId, {
                $inc: {
                  coins: coinsEarned,
                  balance: coinsEarned / 10
                }
              });
            }
          }

          // Save leaderboard data
          const leaderboardDoc = new Leaderboard({
            liveQuiz: liveQuiz._id,
            entries: leaderboardEntries
          });
          await leaderboardDoc.save();

          // Emit leaderboard to room
          io.to(quizId).emit("quizEnd", {
            message: "Quiz ended!",
            leaderboard: leaderboardEntries
          });
        }

      }
    } catch (error) {
      console.error("submitAnswer error:", error);
      socket.emit("error", "Something went wrong");
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("Client disconnected:", reason);
  });
});
const updateQuizStatuses = async () => {

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const quizzes = await LiveQuiz.find({
    $or: [{ status: 'not_started' }, { status: 'started' }],
  });

  for (const quiz of quizzes) {
    const [startHour, startMinute] = quiz.startTime.split(':').map(Number);
    const [endHour, endMinute] = quiz.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    const spansMidnight = endMinutes <= startMinutes;

    // Start quiz
    if (currentMinutes === startMinutes && quiz.status === 'not_started') {
      console.log(quiz._id, 'started');
      quiz.status = 'started';
      await quiz.save();
      io.emit('quizStarted', { quizId: quiz._id });
    }

    // End quiz
    if (
      quiz.status === 'started' &&
      (
        (!spansMidnight && currentMinutes === endMinutes) ||
        (spansMidnight && (currentMinutes === endMinutes))
      )
    ) {
      console.log(quiz._id, 'ended');
      quiz.status = 'ended';
      await quiz.save();
      io.emit('quizEnded', { quizId: quiz._id });
    }
  }
};

// Call every 30 seconds
setInterval(updateQuizStatuses, 30 * 1000);

app.get('/', (req, res) => {
  res.send('🚀 API is Running...');
});
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Database Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
  });

