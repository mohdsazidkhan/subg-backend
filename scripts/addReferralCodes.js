// scripts/addReferralCodes.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');

dotenv.config();

function generateReferralCode() {
  return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}

async function getUniqueReferralCode() {
  let code;
  let exists = true;
  while (exists) {
    code = generateReferralCode();
    exists = await User.exists({ referralCode: code });
  }
  return code;
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to DB ✅');

    // Step 1: Jinka referralCode duplicate ya null hai unko null set karo
    const duplicates = await User.aggregate([
      { $group: { _id: "$referralCode", count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { _id: { $ne: null }, count: { $gt: 1 } } }
    ]);

    for (const dup of duplicates) {
      // First user ka code rehne do, baaki ko null karo
      const idsToUpdate = dup.ids.slice(1);
      await User.updateMany({ _id: { $in: idsToUpdate } }, { $set: { referralCode: null } });
    }

    // Step 2: Jinka referralCode missing/null hai unko unique assign karo
    const usersWithoutCode = await User.find({ $or: [{ referralCode: null }, { referralCode: { $exists: false } }] });

    console.log(`Total users to update: ${usersWithoutCode.length}`);

    for (const user of usersWithoutCode) {
      const code = await getUniqueReferralCode();
      user.referralCode = code;
      await user.save();
      console.log(`Set referralCode ${code} for user ${user._id}`);
    }

    console.log('Referral code update completed ✅');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
