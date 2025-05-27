// controllers/studentController.js
const User = require('../models/User');

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // from protect middleware JWT verify
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('coins badges wallet');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ coins: user.coins, badges: user.badges, wallet: user.wallet });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// For example, add coins after quiz completion
exports.addCoins = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coinsEarned } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.coins += coinsEarned;
    user.wallet.coins = user.coins;
    await user.save();

    res.json({ message: 'Coins added', coins: user.coins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.addBadge = async (req, res) => {
  try {
    const userId = req.user.id;
    const { badge } = req.body;

    if (!badge) return res.status(400).json({ error: 'Badge is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Avoid duplicates
    if (user.badges.includes(badge)) {
      return res.status(400).json({ error: 'Badge already assigned' });
    }

    user.badges.push(badge);
    await user.save();

    res.json({ message: 'Badge added successfully', badges: user.badges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.removeBadge = async (req, res) => {
  try {
    const userId = req.user.id;
    const { badge } = req.body;

    if (!badge) return res.status(400).json({ error: 'Badge is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.badges = user.badges.filter(b => b !== badge);
    await user.save();

    res.json({ message: 'Badge removed successfully', badges: user.badges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
