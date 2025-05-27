// createAdmin.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const bcrypt = require('bcryptjs');
const User = require('./models/User');


const createAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const existingAdmin = await User.findOne({ email: 'admin@example.com' });
  if (existingAdmin) {
    console.log('Admin already exists.');
    process.exit();
  }

  const hashedPassword = await bcrypt.hash('admin@123', 10);
  const adminUser = new User({
    name: 'Super Admin',
    email: 'admin@subg.com',
    password: hashedPassword,
    role: 'admin',
    phone: '9999999999'
  });

  await adminUser.save();
  console.log('✅ Admin created: admin@subg.com / admin@123');
  process.exit();
};

createAdmin();
