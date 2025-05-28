const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  questionText: String,
  options: [String],
  correctAnswerIndex: Number,
  timeLimit: {
    type: Number, // in seconds
    default: 30,  // optional: default time if not specified
    min: 5        // optional: minimum allowed
  },
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
