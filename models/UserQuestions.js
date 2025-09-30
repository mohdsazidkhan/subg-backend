const mongoose = require('mongoose');

const userQuestionAnswerSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	selectedOptionIndex: { type: Number, required: true, min: 0, max: 3 },
	answeredAt: { type: Date, default: Date.now }
}, { _id: false });

const userQuestionsSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
	questionText: { type: String, required: true, trim: true },
	options: {
		type: [String],
		validate: {
			validator: function(arr) { return Array.isArray(arr) && arr.length === 4; },
			message: 'Exactly 4 options are required.'
		},
		required: true
	},
	correctOptionIndex: { type: Number, required: true, min: 0, max: 3 },
	status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
	viewsCount: { type: Number, default: 0 },
	likesCount: { type: Number, default: 0 },
	sharesCount: { type: Number, default: 0 },
	answers: { type: [userQuestionAnswerSchema], default: [] }
}, { timestamps: true });

userQuestionsSchema.index({ status: 1, createdAt: -1 });
userQuestionsSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('UserQuestions', userQuestionsSchema);


