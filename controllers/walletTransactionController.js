const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');

exports.getUserWalletTransactions = async (req, res) => {
  const userId = req.params.userId;
  const requestingUserId = req.user.id; // From JWT token
    
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if the requesting user is accessing their own transactions or is an admin
    if (user._id.toString() !== requestingUserId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own transactions.'
      });
    }

    const transactions = await WalletTransaction.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate('liveQuizId') // optional
      .exec();

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });

  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet transactions',
      error: error.message
    });
  }
};
