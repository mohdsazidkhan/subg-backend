const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const userSchema = new mongoose.Schema({
  publicId: {
    type: String,
    unique: true,
    default: uuidv4,
  },
  name: String,
  email: { type: String, unique: true },
  phone: { type: String, unique: true },
  password: { type: String },
  role: { type: String, enum: ['admin', 'student'], default: 'student' },
  coins: { type: Number, default: 0 },
  badges: { type: [String], default: ['Student'] },
  balance: { type: Number, default: 0 },
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);
