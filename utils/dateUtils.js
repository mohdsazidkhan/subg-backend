// utils/dateUtils.js

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes

// Convert any UTC date to IST Date object
function convertToIST(date) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

// Get start and end of "today" in IST, returned as UTC times
function getISTDayRangeInUTC(date = new Date()) {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);

  const startOfISTDay = new Date(istDate.setHours(0, 0, 0, 0));
  const endOfISTDay = new Date(istDate.setHours(23, 59, 59, 999));

  const startOfDayUTC = new Date(startOfISTDay.getTime() - IST_OFFSET_MS);
  const endOfDayUTC = new Date(endOfISTDay.getTime() - IST_OFFSET_MS);

  return { startOfDayUTC, endOfDayUTC };
}

// Utility functions for date calculations in analytics

const getDateRange = (period) => {
  const now = new Date();
  let startDate;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    
    case 'week':
      const dayOfWeek = now.getDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday is start of week
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
      break;
    
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    
    case '3months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    
    case '6months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    
    case '3years':
      startDate = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
      break;
    
    case '10years':
      startDate = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
      break;
    
    default:
      // Default to 30 days
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return {
    startDate,
    endDate: now
  };
};

const getPeriodLabel = (period) => {
  const labels = {
    'today': 'Today',
    'week': 'This Week',
    'month': 'This Month',
    '3months': 'Last 3 Months',
    '6months': 'Last 6 Months',
    'year': 'This Year',
    '3years': 'Last 3 Years',
    '10years': 'Last 10 Years'
  };
  return labels[period] || 'Last 30 Days';
};

const getPeriodOptions = () => {
  return [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: '3months', label: 'Last 3 Months' },
    { value: '6months', label: 'Last 6 Months' },
    { value: 'year', label: 'This Year' },
    { value: '3years', label: 'Last 3 Years' },
    { value: '10years', label: 'Last 10 Years' }
  ];
};

module.exports = {
  convertToIST,
  getISTDayRangeInUTC,
  getDateRange,
  getPeriodLabel,
  getPeriodOptions
};
