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

// Get all contacts with pagination
exports.getContacts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      Contact.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Contact.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      contacts,
      total,
      page,
      limit
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch contacts.', error: error.message });
  }
}; 