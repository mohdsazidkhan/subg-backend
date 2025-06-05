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

module.exports = {
  convertToIST,
  getISTDayRangeInUTC
};
