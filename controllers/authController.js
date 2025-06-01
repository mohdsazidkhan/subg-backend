const dotenv = require('dotenv');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WalletTransaction = require('../models/WalletTransaction');
dotenv.config();

exports.register = async (req, res) => {
  const { name, email, phone, password, role = 'student' } = req.body;
  const defaultCoins = process.env.SIGNUP_COINS;
  const defaultINR = process.env.SIGNUP_INR;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      balance: defaultINR,
      coins: defaultCoins
    });

    // Optional: record signup bonus in wallet transaction
    await WalletTransaction.create({
      user: user._id,
      type: 'earn_coins',
      amount: defaultCoins,
      currency: 'COINS',
      description: 'Signup Bonus'
    });

    res.status(201).json({
      message: '🎉 Registered Successfully!',
      user: {
        publicId: user.publicId,
        name: user.name,
        email: user.email,
        role: user.role,
        coins: user.coins
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({
      message: '🎉 Login Successful!',
      token,
      user: { publicId: user.publicId, name: user.name, email: user.email, role: user.role, coins: user.coins, balance: user.balance, badges: user.badges }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
