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

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  }
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });

  // ✅ Join room and send first question
  socket.on('joinRoom', async ({ quizId, userId }) => {
    try {
      socket.join(quizId);
      console.log(`User ${userId} joined room ${quizId}`);

      const quiz = await LiveQuiz.find({quiz: quizId}).populate('quiz');
      if (!quiz) return socket.emit('error', { message: 'Live quiz not found' });
      //console.log(quiz[0]?.quiz,'quiz')
      const questions = await Question.find({ quiz: quiz[0]?.quiz });
      const index = quiz.currentQuestionIndex || 0;
      const question = questions[index];

      if (question) {
        io.to(quizId).emit('question', { question });
      } else {
        io.to(quizId).emit('quizEnd', { message: 'No questions available' });
      }
    } catch (err) {
      console.error('Error in joinRoom:', err);
      socket.emit('error', { message: 'Error joining room' });
    }
  });

  // ✅ Submit answer and update leaderboard
  socket.on('submitAnswer', async ({ quizId, userId, questionId, answer }) => {
    try {
      const liveQuizArr = await LiveQuiz.find({ quiz: quizId }).populate('quiz');
      const liveQuiz = liveQuizArr[0];
      if (!liveQuiz) return socket.emit('error', { message: 'Live quiz not found' });

      const question = await mongoose.model('Question').findById(questionId);
      if (!question) return;

      const isCorrect = question.options[question.correctAnswerIndex] === answer;

      // Find participant index
      let participantIndex = liveQuiz.participants.findIndex(
        (p) => p.user.toString() === userId
      );

      if (participantIndex === -1) {
        // New participant, start at question 0
        liveQuiz.participants.push({
          user: userId,
          score: isCorrect ? 1 : 0,
          coinsEarned: isCorrect ? 10 : 0,
          currentQuestionIndex: 0, // initialize here
          answers: [{ questionId, answer }],
        });

        if (isCorrect) {
          await mongoose.model('User').findByIdAndUpdate(userId, { $inc: { coins: 10 } });
        }

        participantIndex = liveQuiz.participants.length - 1; // newly added participant index
      } 

      const participant = liveQuiz.participants[participantIndex];

      // Check if already answered this question
      const alreadyAnswered = participant.answers.some(
        (a) => a.questionId.toString() === questionId
      );

      if (!alreadyAnswered) {
        participant.answers.push({ questionId, answer });

        if (isCorrect) {
          participant.score += 1;
          participant.coinsEarned = (participant.coinsEarned || 0) + 10;

          await mongoose.model('User').findByIdAndUpdate(userId, { $inc: { coins: 10 } });
        }
      }

      // Increment participant's current question index
      participant.currentQuestionIndex = (participant.currentQuestionIndex || 0) + 1;

      liveQuiz.markModified('participants');
      await liveQuiz.save();

      const questions = await mongoose.model('Question').find({ quiz: liveQuiz.quiz._id });

      const nextQuestion = questions[participant.currentQuestionIndex];

      if (nextQuestion) {
        // Emit next question only to this participant
        socket.emit('question', { question: nextQuestion });
      } else {
        // Participant finished quiz, send final leaderboard to all participants
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

        io.to(quizId).emit('quizEnd', {
          message: 'Quiz ended!',
          leaderboard,
        });
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

