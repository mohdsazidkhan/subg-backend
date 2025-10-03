const mongoose = require('mongoose');
const UserQuestions = require('../models/UserQuestions');
const UserQuestionLikes = require('../models/UserQuestionLikes');
const UserWallet = require('../models/UserWallet');
const WalletTransaction = require('../models/WalletTransaction');
const UserQuestionViews = require('../models/UserQuestionViews');

const CREDIT_INTERVAL = parseInt(process.env.PRO_USER_APPROVALS_PER_CREDIT || '10', 10);
const CREDIT_AMOUNT = parseInt(process.env.PRO_USER_CREDIT_AMOUNT || '10', 10); // ₹10 per approved question

// Helper function to count user questions in current month
const getCurrentMonthQuestionCount = async (userId) => {
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
	
	return await UserQuestions.countDocuments({
		userId,
		createdAt: {
			$gte: startOfMonth,
			$lte: endOfMonth
		}
	});
};

exports.createQuestion = async (req, res) => {
	try {
		const userId = req.user.id;
		const { questionText, options, correctOptionIndex } = req.body;
		
		// Check monthly question limit
		const currentMonthCount = await getCurrentMonthQuestionCount(userId);
		if (currentMonthCount >= 100) {
			return res.status(429).json({ 
				message: 'You can add max 100 questions in a month',
				error: 'MONTHLY_LIMIT_EXCEEDED',
				currentCount: currentMonthCount,
				limit: 100
			});
		}
		
		if (!questionText || !Array.isArray(options) || options.length !== 4) {
			return res.status(400).json({ message: 'questionText and exactly 4 options are required' });
		}
		if (typeof correctOptionIndex !== 'number' || correctOptionIndex < 0 || correctOptionIndex > 3) {
			return res.status(400).json({ message: 'correctOptionIndex must be 0-3' });
		}
		const doc = await UserQuestions.create({
			userId,
			questionText: String(questionText).trim(),
			options: options.map(o => String(o).trim()),
			correctOptionIndex,
			status: 'pending'
		});
		return res.status(201).json({ success: true, data: doc });
	} catch (err) {
		console.error('createQuestion error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

// Public: list approved questions with optional search and pagination
exports.listPublicQuestions = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit), 100) || 20;
        const skip = (pageNum - 1) * limitNum;

        const filter = { status: 'approved' };
        if (search) {
            filter.$or = [
                { questionText: { $regex: search, $options: 'i' } },
                { options: { $elemMatch: { $regex: search, $options: 'i' } } }
            ];
        }

        const [items, total] = await Promise.all([
            UserQuestions.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .select('questionText options correctOptionIndex viewsCount likesCount sharesCount createdAt userId answers')
                .populate('userId', 'name profilePicture level.levelName'),
            UserQuestions.countDocuments(filter)
        ]);

        const viewerId = req.user?.id || null;
        const data = items.map(doc => {
            let selectedOptionIndex = null;
            if (viewerId && Array.isArray(doc.answers) && doc.answers.length) {
                const found = doc.answers.find(a => String(a.userId) === String(viewerId));
                if (found) selectedOptionIndex = found.selectedOptionIndex;
            }
            return {
                _id: doc._id,
                questionText: doc.questionText,
                options: doc.options,
                correctAnswer: doc.correctOptionIndex,
                viewsCount: doc.viewsCount,
                likesCount: doc.likesCount,
                sharesCount: doc.sharesCount,
                answersCount: doc.answers ? doc.answers.length : 0,
                createdAt: doc.createdAt,
                userId: doc.userId,
                selectedOptionIndex
            };
        });

        return res.json({ success: true, data, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) } });
    } catch (err) {
        console.error('listPublicQuestions error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getQuestion = async (req, res) => {
	try {
		const id = req.params.id;
		if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
		const question = await UserQuestions.findById(id);
		if (!question) return res.status(404).json({ message: 'Question not found' });
		const viewerId = req.user ? req.user.id : null;
		// Only non-owner views increment
		if (viewerId && question.userId.toString() !== viewerId) {
			await UserQuestions.updateOne({ _id: id }, { $inc: { viewsCount: 1 } });
		}
		// Hide non-approved from non-owner non-admin
		if (question.status !== 'approved') {
			if (!viewerId || question.userId.toString() !== viewerId) {
				return res.status(403).json({ message: 'Not authorized to view this question' });
			}
		}
		return res.json({ success: true, data: question });
	} catch (err) {
		console.error('getQuestion error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

// Public: increment view count for a question
exports.incrementView = async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

        // If authenticated, only count once per user
        const viewerId = req.user && req.user.id ? req.user.id : null;
        if (viewerId) {
            // Do not count owner's self-view
            const q = await UserQuestions.findById(id).select('userId status');
            if (!q || q.status !== 'approved') return res.status(404).json({ message: 'Question not found' });
            if (q.userId.toString() === viewerId) {
                return res.json({ success: true, data: { viewed: false, reason: 'owner' } });
            }
            try {
                await UserQuestionViews.create({ questionId: id, userId: viewerId });
                await UserQuestions.updateOne({ _id: id }, { $inc: { viewsCount: 1 } });
                return res.json({ success: true, data: { viewed: true, firstTime: true } });
            } catch (e) {
                if (e && e.code === 11000) {
                    return res.json({ success: true, data: { viewed: true, firstTime: false } });
                }
                throw e;
            }
        } else {
            // Anonymous: use IP-based throttling via a simple no-op increment (optional). To keep simple, increment always.
            await UserQuestions.updateOne({ _id: id, status: 'approved' }, { $inc: { viewsCount: 1 } });
            return res.json({ success: true, data: { viewed: true, anonymous: true } });
        }
    } catch (err) {
        console.error('incrementView error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.answerQuestion = async (req, res) => {
	try {
		const userId = req.user.id;
		const id = req.params.id;
		const { selectedOptionIndex } = req.body;
		if (typeof selectedOptionIndex !== 'number' || selectedOptionIndex < 0 || selectedOptionIndex > 3) {
			return res.status(400).json({ message: 'selectedOptionIndex must be 0-3' });
		}
		const question = await UserQuestions.findById(id);
		if (!question) return res.status(404).json({ message: 'Question not found' });
		const alreadyAnswered = question.answers.some(a => a.userId.toString() === userId);
		if (alreadyAnswered) return res.status(409).json({ message: 'Already answered' });
		question.answers.push({ userId, selectedOptionIndex, answeredAt: new Date() });
		await question.save();
		return res.json({ success: true, data: { answered: true } });
	} catch (err) {
		console.error('answerQuestion error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

exports.likeQuestion = async (req, res) => {
	try {
		const userId = req.user.id;
		const id = req.params.id;
		if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
		// Ensure question exists
		const question = await UserQuestions.findById(id).select('_id');
		if (!question) return res.status(404).json({ message: 'Question not found' });
		// Try to insert like
		try {
			await UserQuestionLikes.create({ questionId: id, userId });
			await UserQuestions.updateOne({ _id: id }, { $inc: { likesCount: 1 } });
			return res.json({ success: true, data: { liked: true, firstTime: true } });
		} catch (e) {
			if (e && e.code === 11000) {
				return res.json({ success: true, data: { liked: true, firstTime: false } });
			}
			throw e;
		}
	} catch (err) {
		console.error('likeQuestion error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

exports.shareQuestion = async (req, res) => {
	try {
		const id = req.params.id;
		await UserQuestions.updateOne({ _id: id }, { $inc: { sharesCount: 1 } });
		return res.json({ success: true, data: { shared: true } });
	} catch (err) {
		console.error('shareQuestion error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

// Admin helper to credit wallet immediately on approval (per approved question)
exports.creditOnApproval = async (userId, questionId) => {
    const wallet = await UserWallet.findOneAndUpdate(
        { userId },
        { $setOnInsert: { balance: 0, totalEarned: 0 } },
        { upsert: true, new: true }
    );
    const credit = CREDIT_AMOUNT; // ₹10 per approval (configurable)
    wallet.balance = (wallet.balance || 0) + credit;
    wallet.totalEarned = (wallet.totalEarned || 0) + credit;
    await wallet.save();
    // Create wallet transaction entry
    try {
        await WalletTransaction.create({
            user: userId,
            type: 'credit',
            amount: credit,
            balance: wallet.balance,
            description: 'amount credit in user wallet for question',
            category: 'question_reward',
            status: 'completed',
            questionId: questionId || null
        });
    } catch (e) {
        console.error('WalletTransaction create error:', e);
    }
    // Also return current approved count for reference
    const approvedCount = await UserQuestions.countDocuments({ userId, status: 'approved' });
    return { approvedCount, credited: credit };
};

exports.listMyQuestions = async (req, res) => {
	try {
		const userId = req.user.id;
		const { status, page = 1, limit = 20 } = req.query;
		const filter = { userId };
		if (status) filter.status = status;
		const skip = (parseInt(page) - 1) * parseInt(limit);
		const [items, total] = await Promise.all([
			UserQuestions.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
			UserQuestions.countDocuments(filter)
		]);
		return res.json({ success: true, data: items, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
	} catch (err) {
		console.error('listMyQuestions error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

// Get current month question count for user
exports.getCurrentMonthQuestionCount = async (req, res) => {
	try {
		const userId = req.user.id;
		const currentCount = await getCurrentMonthQuestionCount(userId);
		const remaining = Math.max(0, 100 - currentCount);
		
		return res.json({ 
			success: true, 
			data: { 
				currentCount, 
				limit: 100, 
				remaining,
				canAddMore: currentCount < 100
			} 
		});
	} catch (err) {
		console.error('getCurrentMonthQuestionCount error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};


