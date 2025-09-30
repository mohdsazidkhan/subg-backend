const mongoose = require('mongoose');
const UserQuestions = require('../models/UserQuestions');
const WithdrawRequest = require('../models/WithdrawRequest');
const UserWallet = require('../models/UserWallet');
const { creditOnApproval } = require('./proUserQuestionsController');

exports.listUserQuestions = async (req, res) => {
	try {
		const { status, userId, page = 1, limit = 20 } = req.query;
		const filter = {};
		if (status) filter.status = status;
		if (userId) filter.userId = userId;
		const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
            UserQuestions
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('userId', 'name email phone'),
            UserQuestions.countDocuments(filter)
    ]);
		return res.json({ success: true, data: items, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
	} catch (err) {
		console.error('listUserQuestions error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

exports.updateUserQuestionStatus = async (req, res) => {
	try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending','approved','rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const q = await UserQuestions.findById(id);
    if (!q) return res.status(404).json({ message: 'Question not found' });
    const wasApproved = q.status === 'approved';
    q.status = status;
    await q.save();
    if (!wasApproved && status === 'approved') {
        await creditOnApproval(q.userId, q._id);
    }
		return res.json({ success: true, data: q });
	} catch (err) {
		console.error('updateUserQuestionStatus error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

exports.listWithdrawRequests = async (req, res) => {
	try {
		const { status, userId, page = 1, limit = 20 } = req.query;
		const filter = {};
		if (status) filter.status = status;
		if (userId) filter.userId = userId;
		const skip = (parseInt(page) - 1) * parseInt(limit);
		const [items, total] = await Promise.all([
			WithdrawRequest.find(filter).sort({ requestedAt: -1 }).skip(skip).limit(parseInt(limit)),
			WithdrawRequest.countDocuments(filter)
		]);
		return res.json({ success: true, data: items, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
	} catch (err) {
		console.error('listWithdrawRequests error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};

exports.updateWithdrawStatus = async (req, res) => {
	try {
		const { id } = req.params;
		const { status } = req.body;
		if (!['pending','approved','rejected','paid'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
		const wr = await WithdrawRequest.findById(id);
		if (!wr) return res.status(404).json({ message: 'Withdraw request not found' });
		wr.status = status;
		if (status === 'paid') {
			wr.processedAt = new Date();
			await wr.save();
			// Deduct from wallet
			const wallet = await UserWallet.findOne({ userId: wr.userId });
			if (!wallet || wallet.balance < wr.amount) {
				return res.status(400).json({ message: 'Insufficient wallet balance for payout' });
			}
			wallet.balance -= wr.amount;
			await wallet.save();
		} else {
			await wr.save();
		}
		return res.json({ success: true, data: wr });
	} catch (err) {
		console.error('updateWithdrawStatus error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};


