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

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/live-quizzes', liveQuizRoutes);

const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://subg-frontend.vercel.app"
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
  }
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });

  // ✅ Join room and send participant-specific first question
  socket.on('joinRoom', async ({ quizId, userId }) => {
    try {
      // Check if user already attempted the quiz
      const attempt = await QuizAttempt.findOne({ student: userId, quiz: quizId }).populate('student', 'name');
      if (attempt) {
        // Build leaderboard from QuizAttempt collection
        const attempts = await QuizAttempt.find({ quiz: quizId }).populate('student', 'name');
        const leaderboard = attempts.map(a => ({
          userId: a.student._id,
          name: a.student.name,
          score: a.score,
          coinsEarned: a.coinsEarned || 0 // if you track coins in QuizAttempt
        })).sort((a, b) => b.score - a.score);

        // Find user rank
        const userRank = leaderboard.findIndex(entry => entry.userId.toString() === userId.toString()) + 1;

        return socket.emit('alreadyAttempted', {
          message: 'You already attempted this quiz.',
          score: attempt.score,
          coinsEarned: attempt.coinsEarned || 0,
          rank: userRank,
          leaderboard
        });
      }

      // User hasn't attempted, proceed to join room
      socket.join(quizId);
      console.log(`User ${userId} joined room ${quizId}`);

      const liveQuizArr = await LiveQuiz.find({ quiz: quizId }).populate('quiz');
      const liveQuiz = liveQuizArr[0];
      if (!liveQuiz) return socket.emit('error', { message: 'Live quiz not found' });

      // Check if participant already exists
      let participant = liveQuiz.participants.find(p => p.user.toString() === userId);
      if (!participant) {
        participant = {
          user: userId,
          score: 0,
          coinsEarned: 0,
          answers: [],
          currentQuestionIndex: 0
        };
        liveQuiz.participants.push(participant);
        await liveQuiz.save();
      }

      const questions = await Question.find({ quiz: liveQuiz.quiz._id });
      const question = questions[participant.currentQuestionIndex || 0];

      if (question) {
        socket.emit('question', { question });
      } else {
        socket.emit('quizEnd', { message: 'No questions available' });
      }

    } catch (err) {
      console.error('Error in joinRoom:', err);
      socket.emit('error', { message: 'Error joining room' });
    }
  });


  // ✅ Handle answer submission per participant
  socket.on('submitAnswer', async ({ quizId, userId, questionId, answer }) => {
    try {
      const liveQuizArr = await LiveQuiz.find({ quiz: quizId }).populate('quiz');
      const liveQuiz = liveQuizArr[0];
      if (!liveQuiz) return socket.emit('error', { message: 'Live quiz not found' });

      const question = await mongoose.model('Question').findById(questionId);
      if (!question) return;

      const isCorrect = question.options[question.correctAnswerIndex] === answer;

      // Get participant index
      const participantIndex = liveQuiz.participants.findIndex(p => p.user.toString() === userId);
      if (participantIndex === -1) return socket.emit('error', { message: 'Participant not found' });

      const participant = liveQuiz.participants[participantIndex];

      // Avoid duplicate answers
      const alreadyAnswered = participant.answers.some(a => a.questionId.toString() === questionId);
      if (!alreadyAnswered) {
        participant.answers.push({ questionId, answer });

        if (isCorrect) {
          participant.score += 1;
          participant.coinsEarned = (participant.coinsEarned || 0) + 10;
          await mongoose.model('User').findByIdAndUpdate(userId, { $inc: { coins: 10 } });
        }

        participant.currentQuestionIndex = (participant.currentQuestionIndex || 0) + 1;

        // Update participant in array and mark modified for nested array update
        liveQuiz.participants[participantIndex] = participant;
        liveQuiz.markModified('participants');
        await liveQuiz.save();
      }

      const questions = await Question.find({ quiz: liveQuiz.quiz._id });
      const nextQuestion = questions[participant.currentQuestionIndex];

      if (nextQuestion) {
        // Send next question only to this participant
        socket.emit('question', { question: nextQuestion });
      } else {
        // Quiz completed by this participant - save attempt record
        await QuizAttempt.create({
          student: userId,
          quiz: liveQuiz.quiz._id,
          answers: participant.answers,
          score: participant.score,
          coinsEarned: participant.coinsEarned,
          attemptedAt: new Date()
        });

        // Notify participant that quiz ended
        socket.emit('quizEnd', {
          message: 'You have completed the quiz!',
          score: participant.score,
          coinsEarned: participant.coinsEarned || 0,
        });

        // Check if all participants finished the quiz
        const allDone = liveQuiz.participants.every(p => p.currentQuestionIndex >= questions.length);

        if (allDone) {
          // Build leaderboard
          const leaderboard = await Promise.all(
            liveQuiz.participants.map(async (p) => {
              const user = await mongoose.model('User').findById(p.user);
              return {
                userId: user._id,
                name: user.name,
                score: p.score,
                coinsEarned: p.coinsEarned || 0,
              };
            })
          );

          leaderboard.sort((a, b) => b.score - a.score);

          // Broadcast final leaderboard to all in the room
          io.to(quizId).emit('quizEnd', { message: 'Quiz ended!', leaderboard });
        }
      }

    } catch (error) {
      console.error('Error submitting answer:', error);
      socket.emit('error', { message: 'Error submitting answer' });
    }
  });


  // ✅ Optional: allow admin to manually start quiz
  socket.on('startQuiz', async (quizId) => {
    try {
      const quiz = await LiveQuiz.findById(quizId).populate('quiz');
      const questions = await Question.find({ quiz: quiz.quiz._id });
      const question = questions[0];

      if (question) {
        io.to(quizId).emit('question', { question });
      } else {
        io.to(quizId).emit('quizEnd', { message: 'No questions available' });
      }
    } catch (err) {
      console.error('Error starting quiz:', err);
      socket.emit('error', { message: 'Failed to start quiz' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

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

