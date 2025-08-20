const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

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

// Function to populate level completion fields for existing users
const populateLevelCompletion = async () => {
  try {
    console.log('🔄 Starting to populate level completion fields for existing users...');
    
    // Get all student users
    const users = await User.find({ role: 'student' });
    console.log(`📊 Found ${users.length} student users to process`);
    
    let updatedCount = 0;
    
    for (const user of users) {
      try {
        let hasUpdates = false;
        
        // Check Level 6 completion (64 high-score quizzes)
        if (user.level.highScoreQuizzes >= 64 && !user.level6?.completed) {
          user.level6 = {
            completed: true,
            completedAt: user.level.lastLevelUp || new Date()
          };
          hasUpdates = true;
          console.log(`✅ User ${user._id}: Level 6 completed`);
        }
        
        // Check Level 9 completion (512 high-score quizzes)
        if (user.level.highScoreQuizzes >= 512 && !user.level9?.completed) {
          user.level9 = {
            completed: true,
            completedAt: user.level.lastLevelUp || new Date()
          };
          hasUpdates = true;
          console.log(`✅ User ${user._id}: Level 9 completed`);
        }
        
        // Check Level 10 completion (1024 high-score quizzes)
        if (user.level.highScoreQuizzes >= 1024 && !user.level10?.completed) {
          user.level10 = {
            completed: true,
            completedAt: user.level.lastLevelUp || new Date()
          };
          hasUpdates = true;
          console.log(`✅ User ${user._id}: Level 10 completed`);
        }
        
        // Save user if there were updates
        if (hasUpdates) {
          await user.save();
          updatedCount++;
        }
        
      } catch (userError) {
        console.error(`❌ Error processing user ${user._id}:`, userError);
      }
    }
    
    console.log(`✅ Population completed: ${updatedCount} users updated`);
    
    // Print summary
    const level6Count = await User.countDocuments({ 'level6.completed': true });
    const level9Count = await User.countDocuments({ 'level9.completed': true });
    const level10Count = await User.countDocuments({ 'level10.completed': true });
    
    console.log('\n📊 Summary:');
    console.log(`   - Level 6 completed: ${level6Count} users`);
    console.log(`   - Level 9 completed: ${level9Count} users`);
    console.log(`   - Level 10 completed: ${level10Count} users`);
    
  } catch (error) {
    console.error('❌ Error populating level completion:', error);
  }
};

// Run the population
if (require.main === module) {
  populateLevelCompletion()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
} else {
  module.exports = { populateLevelCompletion };
}
