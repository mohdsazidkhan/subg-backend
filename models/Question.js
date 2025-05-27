const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  questionText: String,
  options: [String],
  correctAnswerIndex: Number,
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
