const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');

exports.getUserWalletTransactions = async (req, res) => {

  const userId = req.params.userId;
    
  try {
    const user = await User.findOne({ publicId: userId })
    const transactions = await WalletTransaction.find({ user: user?._id })
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
