const MonthlyWinners = require('../models/MonthlyWinners');

// Get monthly winners for a specific month
exports.getMonthlyWinners = async (req, res) => {
  try {
    const { monthYear } = req.params; // Format: "2024-08"
    
    if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month format. Use YYYY-MM (e.g., 2024-08)'
      });
    }

    const monthlyWinners = await MonthlyWinners.getWinnersByMonth(monthYear);
    
    if (!monthlyWinners) {
      return res.status(404).json({
        success: false,
        message: `No winners found for ${monthYear}`
      });
    }

    res.json({
      success: true,
      data: monthlyWinners
    });
  } catch (error) {
    console.error('Error fetching monthly winners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly winners',
      error: error.message
    });
  }
};

// Get recent monthly winners (last N months)
exports.getRecentMonthlyWinners = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12; // Default to last 12 months
    const monthYear = req.query.monthYear; // Optional monthYear filter
    
    let recentWinners;
    if (monthYear) {
      // If monthYear is provided, get winners for that specific month
      const monthWinners = await MonthlyWinners.getWinnersByMonth(monthYear);
      recentWinners = monthWinners ? [monthWinners] : [];
    } else {
      // Otherwise get recent winners
      recentWinners = await MonthlyWinners.getRecentWinners(limit);
    }
    
    res.json({
      success: true,
      data: recentWinners,
      total: recentWinners.length
    });
  } catch (error) {
    console.error('Error fetching recent monthly winners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent monthly winners',
      error: error.message
    });
  }
};

// Get user's winning history
exports.getUserWinningHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const winningHistory = await MonthlyWinners.getUserWinningHistory(userId);
    
    res.json({
      success: true,
      data: winningHistory,
      total: winningHistory.length
    });
  } catch (error) {
    console.error('Error fetching user winning history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user winning history',
      error: error.message
    });
  }
};

// Get monthly winners statistics
exports.getMonthlyWinnersStats = async (req, res) => {
  try {
    const stats = await MonthlyWinners.getWinnersStats();
    
    res.json({
      success: true,
      data: stats[0] || {
        totalMonths: 0,
        totalWinners: 0,
        totalPrizeDistributed: 0,
        averageWinnersPerMonth: 0
      }
    });
  } catch (error) {
    console.error('Error fetching monthly winners stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly winners statistics',
      error: error.message
    });
  }
};

// Get current month's winners (if available)
exports.getCurrentMonthWinners = async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    const currentMonthWinners = await MonthlyWinners.getWinnersByMonth(currentMonth);
    
    if (!currentMonthWinners) {
      return res.json({
        success: true,
        data: null,
        message: `No winners recorded for ${currentMonth} yet`
      });
    }

    res.json({
      success: true,
      data: currentMonthWinners
    });
  } catch (error) {
    console.error('Error fetching current month winners:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current month winners',
      error: error.message
    });
  }
};
