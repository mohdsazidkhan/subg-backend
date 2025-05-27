const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: String,
  password: String,
  role: { type: String, enum: ['admin', 'student'], default: 'student' },
  coins: { type: Number, default: 0 },
  badges: { type: [String], default: ['Student'] }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
