const mongoose = require('mongoose');
const leaderboardSchema = new mongoose.Schema({
  liveQuiz: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveQuiz', required: true },
  entries: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    score: Number,
    rank: Number,
    coinsEarned: Number,
  }],
}, { timestamps: true });
module.exports = mongoose.model('Leaderboard', leaderboardSchema);

