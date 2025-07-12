const nodemailer = require('nodemailer');
const SibApiV3Sdk = require('sib-api-v3-sdk');

const apiKey = process.env.BREVO_EMAIL_API_KEY;

// Brevo (Sendinblue) transactional email sender
const sendBrevoEmail = async ({ to, subject, html }) => {
  try {
    SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = apiKey;
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.sender = { name: 'SubgQuiz', email: process.env.ADMIN_EMAIL };
    sendSmtpEmail.to = [{ email: to }];
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    return true;
  } catch (err) {
    console.error('Brevo email error:', err.message);
    return false;
  }
};

module.exports = { sendBrevoEmail };
