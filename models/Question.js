const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const questionSchema = new mongoose.Schema({
  publicId: {
    type: String,
    unique: true,
    default: uuidv4,
  },
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
