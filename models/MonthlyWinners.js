const mongoose = require('mongoose');

const monthlyWinnersSchema = new mongoose.Schema({
  month: {
    type: String,
    required: true,
    unique: true // Each month can only have one winners record
  },
  year: {
    type: Number,
    required: true
  },
  monthYear: {
    type: String,
    required: true,
    unique: true // Format: "2024-08" for August 2024
  },
  winners: [{
    rank: {
      type: Number,
      required: true,
      enum: [1, 2, 3] // 1st, 2nd, 3rd place
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    userEmail: {
      type: String,
      required: true
    },
    highScoreWins: {
      type: Number,
      required: true
    },
    accuracy: {
      type: Number,
      required: true
    },
    rewardAmount: {
      type: Number,
      required: true
    },
    claimableRewards: {
      type: Number,
      required: true
    }
  }],
  totalPrizePool: {
    type: Number,
    default: 9999
  },
  totalWinners: {
    type: Number,
    default: 0
  },
  resetDate: {
    type: Date,
    default: Date.now
  },
  processedBy: {
    type: String,
    default: 'monthly_reset_cron'
  },
  metadata: {
    totalEligibleUsers: Number,
    resetTimestamp: Date,
    cronJobId: String
  }
}, { 
  timestamps: true 
});

// Index for efficient queries
monthlyWinnersSchema.index({ year: 1, month: 1 });
monthlyWinnersSchema.index({ 'winners.userId': 1 });

// Method to get winners by month
monthlyWinnersSchema.statics.getWinnersByMonth = function(monthYear) {
  return this.findOne({ monthYear }).populate('winners.userId', 'name email profilePicture');
};

// Method to get all winners for a user
monthlyWinnersSchema.statics.getUserWinningHistory = function(userId) {
  return this.find({
    'winners.userId': userId
  }).sort({ monthYear: -1 });
};

// Method to get recent winners
monthlyWinnersSchema.statics.getRecentWinners = function(limit = 12) {
  return this.find().sort({ monthYear: -1 }).limit(limit);
};

// Method to get winners statistics
monthlyWinnersSchema.statics.getWinnersStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalMonths: { $sum: 1 },
        totalWinners: { $sum: '$totalWinners' },
        totalPrizeDistributed: { $sum: '$totalPrizePool' },
        averageWinnersPerMonth: { $avg: '$totalWinners' }
      }
    }
  ]);
};

module.exports = mongoose.model('MonthlyWinners', monthlyWinnersSchema);
