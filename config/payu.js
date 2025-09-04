const crypto = require('crypto');

// Environment-aware config getter
const getPayuConfig = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    merchantId: isProd ? process.env.PAYU_MERCHANT_ID : process.env.PAYU_MERCHANT_ID_TEST,
    merchantKey: isProd ? process.env.PAYU_MERCHANT_KEY : process.env.PAYU_MERCHANT_KEY_TEST,
    merchantSalt: isProd ? process.env.PAYU_MERCHANT_SALT : process.env.PAYU_MERCHANT_SALT_TEST,
    paymentUrl: isProd ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment'
  };
};

// PayU helper methods following classic hash specification
const payuHelpers = {
  // Request hash: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
  generateRequestHash: ({ key, txnid, amount, productinfo, firstname, email, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '' }, salt) => {
    const raw = [key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5, '', '', '', '', '', salt].join('|');
    return crypto.createHash('sha512').update(raw).digest('hex');
  },

  // Response hash: sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
  generateResponseHash: ({ key, txnid, amount, productinfo, firstname, email, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '', status }, salt) => {
    const raw = [salt, status, '', '', '', '', '', udf5, udf4, udf3, udf2, udf1, email, firstname, productinfo, amount, txnid, key].join('|');
    return crypto.createHash('sha512').update(raw).digest('hex');
  },

  // Validate the response by recomputing expected hash
  validateResponse: (response, { merchantKey, merchantSalt }) => {
    const expected = payuHelpers.generateResponseHash({ key: merchantKey, ...response }, merchantSalt);
    return (response.hash || '').toLowerCase() === expected.toLowerCase();
  },

  // Amount must be rupees string with two decimals
  formatAmountForPayU: (amountNumber) => {
    return Number(amountNumber).toFixed(2);
  },

  // Build backend URLs for surl/furl (PayU redirects to backend, which then redirects to frontend)
  buildServerUrl: (req, path) => {
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    return `${backendUrl}${path}`;
  }
};

module.exports = { getPayuConfig, payuHelpers };

