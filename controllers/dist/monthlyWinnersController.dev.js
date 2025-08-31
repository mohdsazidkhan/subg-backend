"use strict";

var MonthlyWinners = require('../models/MonthlyWinners'); // Get monthly winners for a specific month


exports.getMonthlyWinners = function _callee(req, res) {
  var monthYear, monthlyWinners;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          monthYear = req.params.monthYear; // Format: "2024-08"

          if (!(!monthYear || !/^\d{4}-\d{2}$/.test(monthYear))) {
            _context.next = 4;
            break;
          }

          return _context.abrupt("return", res.status(400).json({
            success: false,
            message: 'Invalid month format. Use YYYY-MM (e.g., 2024-08)'
          }));

        case 4:
          _context.next = 6;
          return regeneratorRuntime.awrap(MonthlyWinners.getWinnersByMonth(monthYear));

        case 6:
          monthlyWinners = _context.sent;

          if (monthlyWinners) {
            _context.next = 9;
            break;
          }

          return _context.abrupt("return", res.status(404).json({
            success: false,
            message: "No winners found for ".concat(monthYear)
          }));

        case 9:
          res.json({
            success: true,
            data: monthlyWinners
          });
          _context.next = 16;
          break;

        case 12:
          _context.prev = 12;
          _context.t0 = _context["catch"](0);
          console.error('Error fetching monthly winners:', _context.t0);
          res.status(500).json({
            success: false,
            message: 'Failed to fetch monthly winners',
            error: _context.t0.message
          });

        case 16:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 12]]);
}; // Get recent monthly winners (last N months)


exports.getRecentMonthlyWinners = function _callee2(req, res) {
  var limit, monthYear, recentWinners, monthWinners;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          limit = parseInt(req.query.limit) || 12; // Default to last 12 months

          monthYear = req.query.monthYear; // Optional monthYear filter

          if (!monthYear) {
            _context2.next = 10;
            break;
          }

          _context2.next = 6;
          return regeneratorRuntime.awrap(MonthlyWinners.getWinnersByMonth(monthYear));

        case 6:
          monthWinners = _context2.sent;
          recentWinners = monthWinners ? [monthWinners] : [];
          _context2.next = 13;
          break;

        case 10:
          _context2.next = 12;
          return regeneratorRuntime.awrap(MonthlyWinners.getRecentWinners(limit));

        case 12:
          recentWinners = _context2.sent;

        case 13:
          res.json({
            success: true,
            data: recentWinners,
            total: recentWinners.length
          });
          _context2.next = 20;
          break;

        case 16:
          _context2.prev = 16;
          _context2.t0 = _context2["catch"](0);
          console.error('Error fetching recent monthly winners:', _context2.t0);
          res.status(500).json({
            success: false,
            message: 'Failed to fetch recent monthly winners',
            error: _context2.t0.message
          });

        case 20:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 16]]);
}; // Get user's winning history


exports.getUserWinningHistory = function _callee3(req, res) {
  var userId, winningHistory;
  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          userId = req.params.userId;

          if (userId) {
            _context3.next = 4;
            break;
          }

          return _context3.abrupt("return", res.status(400).json({
            success: false,
            message: 'User ID is required'
          }));

        case 4:
          _context3.next = 6;
          return regeneratorRuntime.awrap(MonthlyWinners.getUserWinningHistory(userId));

        case 6:
          winningHistory = _context3.sent;
          res.json({
            success: true,
            data: winningHistory,
            total: winningHistory.length
          });
          _context3.next = 14;
          break;

        case 10:
          _context3.prev = 10;
          _context3.t0 = _context3["catch"](0);
          console.error('Error fetching user winning history:', _context3.t0);
          res.status(500).json({
            success: false,
            message: 'Failed to fetch user winning history',
            error: _context3.t0.message
          });

        case 14:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 10]]);
}; // Get monthly winners statistics


exports.getMonthlyWinnersStats = function _callee4(req, res) {
  var stats;
  return regeneratorRuntime.async(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.prev = 0;
          _context4.next = 3;
          return regeneratorRuntime.awrap(MonthlyWinners.getWinnersStats());

        case 3:
          stats = _context4.sent;
          res.json({
            success: true,
            data: stats[0] || {
              totalMonths: 0,
              totalWinners: 0,
              totalPrizeDistributed: 0,
              averageWinnersPerMonth: 0
            }
          });
          _context4.next = 11;
          break;

        case 7:
          _context4.prev = 7;
          _context4.t0 = _context4["catch"](0);
          console.error('Error fetching monthly winners stats:', _context4.t0);
          res.status(500).json({
            success: false,
            message: 'Failed to fetch monthly winners statistics',
            error: _context4.t0.message
          });

        case 11:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[0, 7]]);
}; // Get current month's winners (if available)


exports.getCurrentMonthWinners = function _callee5(req, res) {
  var currentMonth, currentMonthWinners;
  return regeneratorRuntime.async(function _callee5$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.prev = 0;
          currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

          _context5.next = 4;
          return regeneratorRuntime.awrap(MonthlyWinners.getWinnersByMonth(currentMonth));

        case 4:
          currentMonthWinners = _context5.sent;

          if (currentMonthWinners) {
            _context5.next = 7;
            break;
          }

          return _context5.abrupt("return", res.json({
            success: true,
            data: null,
            message: "No winners recorded for ".concat(currentMonth, " yet")
          }));

        case 7:
          res.json({
            success: true,
            data: currentMonthWinners
          });
          _context5.next = 14;
          break;

        case 10:
          _context5.prev = 10;
          _context5.t0 = _context5["catch"](0);
          console.error('Error fetching current month winners:', _context5.t0);
          res.status(500).json({
            success: false,
            message: 'Failed to fetch current month winners',
            error: _context5.t0.message
          });

        case 14:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[0, 10]]);
};