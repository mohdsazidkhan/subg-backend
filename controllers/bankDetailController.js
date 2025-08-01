const BankDetail = require('../models/BankDetail');
const User = require('../models/User');

// Save or update bank details for a user
exports.saveBankDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { accountHolderName, accountNumber, bankName, ifscCode, branchName } = req.body;
    // Check if user is eligible (level 10 or pro subscription)
    console.log(req.user.id, 'req.user');
    const user = await User.findById(userId);
    const isLevelTen = user.level && user.level.currentLevel === 10;
    const isProPlan = user.subscriptionStatus === 'pro';

    if (!isLevelTen && !isProPlan) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only users at level 10 or with pro subscription can add bank details.' 
      });
    }

    // Check if bank details already exist for this user
    let bankDetail = await BankDetail.findOne({ user: userId });

    if (bankDetail) {
      // Update existing bank details
      bankDetail.accountHolderName = accountHolderName;
      bankDetail.accountNumber = accountNumber;
      bankDetail.bankName = bankName;
      bankDetail.ifscCode = ifscCode;
      bankDetail.branchName = branchName;
      bankDetail.updatedAt = Date.now();
      
      await bankDetail.save();
      return res.status(200).json({ 
        success: true, 
        message: 'Bank details updated successfully.',
        bankDetail
      });
    } else {
      // Create new bank details
      bankDetail = new BankDetail({
        user: userId,
        accountHolderName,
        accountNumber,
        bankName,
        ifscCode,
        branchName
      });
      
      await bankDetail.save();
      return res.status(201).json({ 
        success: true, 
        message: 'Bank details saved successfully.',
        bankDetail
      });
    }
  } catch (error) {
    console.error('Error saving bank details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save bank details.', 
      error: error.message 
    });
  }
};

// Get bank details for the logged-in user
exports.getBankDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const bankDetail = await BankDetail.findOne({ user: userId });
    
    if (!bankDetail) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bank details not found for this user.' 
      });
    }
    
    res.status(200).json({
      success: true,
      bankDetail
    });
  } catch (error) {
    console.error('Error fetching bank details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch bank details.', 
      error: error.message 
    });
  }
};

// Get all bank details (admin only) with pagination
exports.getAllBankDetails = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [bankDetails, total] = await Promise.all([
      BankDetail.find()
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BankDetail.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      bankDetails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching all bank details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch bank details.', 
      error: error.message 
    });
  }
};