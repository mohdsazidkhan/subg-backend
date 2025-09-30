const mongoose = require('mongoose');

const userQuestionViewsSchema = new mongoose.Schema({
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserQuestions', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    viewedAt: { type: Date, default: Date.now }
}, { timestamps: true });

userQuestionViewsSchema.index({ questionId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('UserQuestionViews', userQuestionViewsSchema);


