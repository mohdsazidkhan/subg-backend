const dotenv = require('dotenv');
dotenv.config();

const INR_TO_COINS = parseInt(process.env.INR_TO_COINS || 10);
const COINS_TO_INR = parseInt(process.env.COINS_TO_INR || 10);

/**
 * Convert INR to coins
 * @param {number} inr
 * @returns {number}
 */
function convertINRToCoins(inr) {
  return inr * INR_TO_COINS;
}

/**
 * Convert coins to INR
 * @param {number} coins
 * @returns {number}
 */
function convertCoinsToINR(coins) {
  return Math.floor(coins / COINS_TO_INR); // Use floor to avoid decimal INR
}

module.exports = {
  convertINRToCoins,
  convertCoinsToINR
};
