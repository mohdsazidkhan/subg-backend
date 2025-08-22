const Category = require('../models/Category');
const User = require('../models/User');

// GET /api/public/categories - Public categories API
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({});
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: err.message });
  }
};

// GET /api/public/top-performers - Public top performers API for students
exports.getTopPerformers = async (req, res) => {
  try {
    const { limit = 10, year } = req.query;
    
    // Calculate academic year (April 1st to March 31st)
    let academicYearStart, academicYearEnd;
    
    if (year && year !== 'current') {
      // If specific year is requested (e.g., "2023-2024")
      const [startYear, endYear] = year.split('-').map(y => parseInt(y));
      academicYearStart = new Date(startYear, 3, 1); // April 1st
      academicYearEnd = new Date(endYear, 2, 31); // March 31st
    } else {
      // Current academic year
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
      
      if (currentMonth >= 4) {
        // If current month is April or later, academic year started this year
        academicYearStart = new Date(currentYear, 3, 1); // April 1st (month 3 = April)
        academicYearEnd = new Date(currentYear + 1, 2, 31); // March 31st next year (month 2 = March)
      } else {
        // If current month is January-March, academic year started last year
        academicYearStart = new Date(currentYear - 1, 3, 1); // April 1st last year
        academicYearEnd = new Date(currentYear, 2, 31); // March 31st this year
      }
    }
    
    // Get top performers based on high scores and average scores for current academic year
    // Show students who have been active during the academic year (not just joined during)
    const topPerformers = await User.find({ 
      role: 'student',
      'level.highScoreQuizzes': { $gt: 0 } // Only include students with high scores
    })
      .sort({ 
        'level.highScoreQuizzes': -1, 
        'level.averageScore': -1,
        'level.totalScore': -1 
      })
      .limit(parseInt(limit))
      .select('_id name level createdAt')
      .lean();

    // Format the data for frontend consumption
    const formattedPerformers = topPerformers.map(user => ({
      userId: user._id,
      name: user.name,
      level: {
        currentLevel: user.level?.currentLevel || 1,
        levelName: getLevelName(user.level?.currentLevel || 1),
        highScoreQuizzes: user.level?.highScoreQuizzes || 0,
        averageScore: user.level?.averageScore || 0,
        totalScore: user.level?.totalScore || 0,
        quizzesPlayed: user.level?.quizzesPlayed || 0
      },
      joinedDate: user.createdAt
    }));

    // Format academic year for display
    const academicYearDisplay = `${academicYearStart.getFullYear()}-${academicYearEnd.getFullYear()}`;

    res.json({
      success: true,
      data: {
        topPerformers: formattedPerformers,
        academicYear: academicYearDisplay,
        academicYearStart: academicYearStart.toISOString(),
        academicYearEnd: academicYearEnd.toISOString(),
        total: formattedPerformers.length
      }
    });
  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top performers',
      error: error.message
    });
  }
};

// Helper function to get level names
const getLevelName = (level) => {
  const levelNames = {
    1: 'Rookie', 2: 'Explorer', 3: 'Thinker', 4: 'Strategist', 5: 'Achiever',
    6: 'Mastermind', 7: 'Champion', 8: 'Prodigy', 9: 'Quiz Wizard', 10: 'Legend'
  };
  return levelNames[level] || 'Unknown';
};
