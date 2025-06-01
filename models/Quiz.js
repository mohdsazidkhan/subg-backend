const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const quizSchema = new mongoose.Schema({
  publicId: {
    type: String,
    unique: true,
    default: uuidv4,
  },
  title: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Subcategory' },
  totalMarks: Number,
  timeLimit: Number, // in minutes
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);
