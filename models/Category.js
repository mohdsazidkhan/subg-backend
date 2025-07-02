const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
