const mongoose = require('mongoose');
const WithdrawRequest = require('../models/WithdrawRequest');
const UserWallet = require('../models/UserWallet');
const UserQuestions = require('../models/UserQuestions');

// Environment variables for withdrawal configuration
const MIN_APPROVED_QUESTIONS = parseInt(process.env.MIN_APPROVED_QUESTIONS || '100', 10);
const MIN_WITHDRAW_AMOUNT = parseInt(process.env.MIN_WITHDRAW_AMOUNT || '1000', 10);

exports.createWithdrawRequest = async (req, res) => {
	try {
		const userId = req.user.id;
		const { amount, bankDetails, upi } = req.body;
		if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
		if (amount < MIN_WITHDRAW_AMOUNT) return res.status(400).json({ message: `Minimum withdrawal amount is ₹${MIN_WITHDRAW_AMOUNT}` });
		const wallet = await UserWallet.findOneAndUpdate(
			{ userId },
			{ $setOnInsert: { balance: 0, totalEarned: 0 } },
			{ upsert: true, new: true }
		);
		const approvedCount = await UserQuestions.countDocuments({ userId, status: 'approved' });
		if (approvedCount < MIN_APPROVED_QUESTIONS) return res.status(403).json({ message: `At least ${MIN_APPROVED_QUESTIONS} approved questions required` });
		if (wallet.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });
		const reqDoc = await WithdrawRequest.create({
			userId,
			amount,
			bankDetails: bankDetails || null,
			upi: upi || null,
			status: 'pending',
			requestedAt: new Date()
		});
		return res.status(201).json({ success: true, data: reqDoc });
	} catch (err) {
		console.error('createWithdrawRequest error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};


