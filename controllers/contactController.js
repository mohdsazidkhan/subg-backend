const Contact = require('../models/Contact');

// Save a new contact
exports.createContact = async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const contact = new Contact({ name, email, message });
    await contact.save();
    res.status(201).json({ success: true, message: 'Contact saved successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save contact.', error: error.message });
  }
};

