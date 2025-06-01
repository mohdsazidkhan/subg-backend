const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const subcategorySchema = new mongoose.Schema({
  publicId: {
      type: String,
      unique: true,
      default: uuidv4,
    },
  name: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Subcategory', subcategorySchema);
