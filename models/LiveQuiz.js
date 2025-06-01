// models/LiveQuiz.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const liveQuizSchema = new mongoose.Schema({
  publicId: {
    type: String,
    unique: true,
    default: uuidv4,
  },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['not_started', 'started', 'ended'],
    default: 'not_started'
  },
  currentQuestionIndex: { type: Number, default: 0 }, // global quiz progress (for live mode)
  accessType: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free'
  },
  coinsToPlay: {
    type: Number,
    default: 0,
  },
  startTime: {
    type: String,
    default: null,
  },
  endTime: { 
    type: String, 
    default: null 
  }
}, { timestamps: true });

module.exports = mongoose.model('LiveQuiz', liveQuizSchema);
