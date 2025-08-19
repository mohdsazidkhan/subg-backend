const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cron = require('node-cron');
const rewardsController = require('../controllers/rewardsController');

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Database Connected to MongoDB');
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// Function to process Level 10 leaderboard and unlock rewards
const processLevel10Rewards = async () => {
  try {
    console.log('🔄 Starting Level 10 rewards processing...');
    
    // Create a mock request object for the controller
    const mockReq = {};
    const mockRes = {
      json: (data) => {
        console.log('✅ Rewards processing completed:', data);
      },
      status: (code) => ({
        json: (data) => {
          console.error(`❌ Error ${code}:`, data);
        }
      })
    };
    
    await rewardsController.processLevel10Leaderboard(mockReq, mockRes);
    
    console.log('✅ Level 10 rewards processing completed successfully');
  } catch (error) {
    console.error('❌ Error processing Level 10 rewards:', error);
  }
};

// Schedule the job to run daily at 2 AM
const scheduleRewardsProcessing = () => {
  console.log('📅 Scheduling rewards processing job...');
  
  cron.schedule('0 2 * * *', () => {
    console.log('⏰ Running scheduled rewards processing...');
    processLevel10Rewards();
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  
  console.log('✅ Rewards processing job scheduled for daily at 2 AM IST');
};

// Manual execution function
const runManually = async () => {
  console.log('🚀 Running rewards processing manually...');
  await processLevel10Rewards();
  process.exit(0);
};

// Check if script is run manually
if (require.main === module) {
  runManually();
} else {
  // Export for use in other modules
  module.exports = {
    processLevel10Rewards,
    scheduleRewardsProcessing
  };
}

// Start scheduling if not run manually
if (require.main !== module) {
  scheduleRewardsProcessing();
}
