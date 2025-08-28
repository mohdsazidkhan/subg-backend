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
    
    const currentUserId = req.user.id; // Get current user ID from auth middleware (optional)
    
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
    
    // Get all users for ranking calculation
    const allUsers = await User.find({ 
      role: 'student'
    })
      .select('_id name level createdAt')
      .lean();

    // Ensure all users have level data, set defaults if missing
    allUsers.forEach(user => {
      if (!user.level) {
        user.level = {
          currentLevel: 0,
          levelName: 'Zero Level',
          quizzesPlayed: 0,
          highScoreQuizzes: 0,
          averageScore: 0
        };
      }
    });

    // Custom sorting: First by high score (descending), then by total quizzes (ascending - fewer is better)
    allUsers.sort((a, b) => {
      const aHighScore = a.level?.highScoreQuizzes || 0;
      const bHighScore = b.level?.highScoreQuizzes || 0;
      const aTotalQuizzes = a.level?.quizzesPlayed || 0;
      const bTotalQuizzes = b.level?.quizzesPlayed || 0;
      
      // First priority: High score (descending)
      if (aHighScore !== bHighScore) {
        return bHighScore - aHighScore;
      }
      
      // Second priority: Total quizzes (ascending - fewer is better)
      if (aTotalQuizzes !== bTotalQuizzes) {
        return aTotalQuizzes - bTotalQuizzes;
      }
      
      // Third priority: Average score (descending)
      const aAvgScore = a.level?.averageScore || 0;
      const bAvgScore = b.level?.averageScore || 0;
      return bAvgScore - aAvgScore;
    });

    // Get top 10 performers
    const topPerformers = allUsers.slice(0, parseInt(limit));

    // Find current user's position and surrounding users
    let currentUserData = null;
    let surroundingUsers = [];
    
    console.log('🔍 Debug - Current User ID:', currentUserId);
    console.log('🔍 Debug - Total Users Found:', allUsers.length);
    
    if (currentUserId) {
      const currentUserIndex = allUsers.findIndex(user => user._id.toString() === currentUserId.toString());
      console.log('🔍 Debug - Current User Index:', currentUserIndex);
      
      if (currentUserIndex !== -1) {
        // Get exactly 3 users: 1 before + current + 1 after (when possible)
        let surroundingUsersList = [];
        
        if (currentUserIndex === 0) {
          // Current user is at position 1, get next 2 users
          surroundingUsersList = allUsers.slice(1, 3);
        } else if (currentUserIndex === allUsers.length - 1) {
          // Current user is at last position, get previous 2 users
          surroundingUsersList = allUsers.slice(currentUserIndex - 2, currentUserIndex);
        } else {
          // Current user is in middle: get 1 before + current + 1 after
          surroundingUsersList = allUsers.slice(currentUserIndex - 1, currentUserIndex + 2);
        }
        
        // Ensure we have exactly 3 users total
        surroundingUsersList = surroundingUsersList.slice(0, 3);
        
        surroundingUsers = surroundingUsersList.map((user, index) => ({
          ...user,
          position: user.position || (allUsers.indexOf(user) + 1),
          isCurrentUser: user._id.toString() === currentUserId.toString()
        }));
        
        // Add current user data separately
        currentUserData = {
          ...allUsers[currentUserIndex],
          position: currentUserIndex + 1,
          isCurrentUser: true
        };
        
        console.log('🔍 Debug - Surrounding Users Count:', surroundingUsers.length);
        console.log('🔍 Debug - Current User Position:', currentUserData.position);
        console.log('🔍 Debug - Surrounding Users Positions:', surroundingUsers.map(u => ({ name: u.name, position: u.position, isCurrentUser: u.isCurrentUser })));
      } else {
        console.log('❌ Current user not found in ranking list');
      }
    } else {
      console.log('❌ No current user ID provided');
    }

    // Format the data for frontend consumption
    const formatUser = (user, position = null, isCurrentUser = false) => {
      const highScoreQuizzes = user.level?.highScoreQuizzes || 0;
      const quizzesPlayed = user.level?.quizzesPlayed || 0;
      const accuracy = quizzesPlayed > 0 ? Math.round((highScoreQuizzes / quizzesPlayed) * 100) : 0;
      
      return {
        userId: user._id,
        name: user.name,
        position: position,
        isCurrentUser: isCurrentUser,
        level: {
          currentLevel: user.level?.currentLevel || 1,
          levelName: getLevelName(user.level?.currentLevel || 1),
          highScoreQuizzes: highScoreQuizzes,
          averageScore: user.level?.averageScore || 0,
          quizzesPlayed: quizzesPlayed,
          accuracy: accuracy
        },
        joinedDate: user.createdAt
      };
    };

    const formattedTopPerformers = topPerformers.map((user, index) => 
      formatUser(user, index + 1, user._id.toString() === currentUserId?.toString())
    );

    const formattedSurroundingUsers = surroundingUsers.map(user => 
      formatUser(user, user.position, user.isCurrentUser)
    );

    // Format academic year for display
    const academicYearDisplay = `${academicYearStart.getFullYear()}-${academicYearEnd.getFullYear()}`;

    const responseData = {
      success: true,
      data: {
        topPerformers: formattedTopPerformers,        // Top 10 users
        currentUser: currentUserData ? formatUser(currentUserData, currentUserData.position, true) : null,  // Current user data with position
        surroundingUsers: formattedSurroundingUsers,  // 1 before + current + 1 after (3 users total)
        academicYear: academicYearDisplay,
        academicYearStart: academicYearStart.toISOString(),
        academicYearEnd: academicYearEnd.toISOString(),
        total: allUsers.length
      }
    };

    console.log('🔍 Debug - Response Data:', {
      topPerformersCount: formattedTopPerformers.length,
      currentUserExists: !!responseData.data.currentUser,
      surroundingUsersCount: formattedSurroundingUsers.length,
      totalUsers: allUsers.length
    });

    res.json(responseData);
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
