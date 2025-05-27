const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Subcategory' },
  totalMarks: Number,
  timeLimit: Number, // in minutes
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);
