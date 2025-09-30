const User = require('../models/User');

module.exports = async (req, res, next) => {
	try {
		const userId = req.user && (req.user.id || req.user._id);
		if (!userId) {
			return res.status(401).json({ message: 'Not authorized' });
		}
		const user = await User.findById(userId).select('subscriptionStatus role');
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}
		if (user.role === 'admin') {
			return next();
		}
		if ((user.subscriptionStatus || 'free').toLowerCase() !== 'pro') {
			return res.status(403).json({ message: 'Pro subscription required' });
		}
		return next();
	} catch (err) {
		console.error('requireProUser error:', err);
		return res.status(500).json({ message: 'Internal server error' });
	}
};


