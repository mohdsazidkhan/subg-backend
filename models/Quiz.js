const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Subcategory' },
  totalMarks: Number,
  timeLimit: Number, // in minutes
  
  // Level-based quiz system
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  requiredLevel: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  recommendedLevel: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  levelRange: {
    min: { type: Number, default: 1, min: 1, max: 10 },
    max: { type: Number, default: 10, min: 1, max: 10 }
  },
  tags: [String], // For additional categorization
  description: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for efficient level-based queries
quizSchema.index({ requiredLevel: 1, isActive: 1 });
quizSchema.index({ difficulty: 1, isActive: 1 });

module.exports = mongoose.model('Quiz', quizSchema);
