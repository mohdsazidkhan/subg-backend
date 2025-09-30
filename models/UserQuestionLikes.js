const mongoose = require('mongoose');

const userQuestionLikesSchema = new mongoose.Schema({
	questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserQuestions', required: true, index: true },
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
}, { timestamps: true });

userQuestionLikesSchema.index({ questionId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('UserQuestionLikes', userQuestionLikesSchema);


