const UserWallet = require('../models/UserWallet');
const UserQuestions = require('../models/UserQuestions');

exports.getWallet = async (req, res) => {
	try {
		const { userId } = req.params;
		const requesterId = req.user.id;
		if (requesterId !== userId && req.user.role !== 'admin') {
			return res.status(403).json({ message: 'Forbidden' });
		}
		const wallet = await UserWallet.findOneAndUpdate(
			{ userId },
			{ $setOnInsert: { balance: 0, totalEarned: 0 } },
			{ upsert: true, new: true }
		);
		const approvedCount = await UserQuestions.countDocuments({ userId, status: 'approved' });
		return res.json({ success: true, data: { balance: wallet.balance, totalEarned: wallet.totalEarned, approvedCount } });
	} catch (err) {
		console.error('getWallet error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};


