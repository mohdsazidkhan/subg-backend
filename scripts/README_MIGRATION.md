# 🚀 Migration to Monthly System - FRESH START

## Overview
This script will **RESET ALL USERS to Level 0** and migrate them from the old yearly system to the new monthly system.

## ⚠️ WARNING
**This action is irreversible!** All users will lose their current level progress and start fresh at Level 0.

## What Happens During Migration
1. **All users reset to Level 0 (Starter)**
2. **Monthly progress starts from 0**
3. **All claimable rewards reset to ₹0**
4. **All subscriptions reset to Free**
5. **Users marked as migrated to prevent double-migration**
6. **Old data preserved in migration details for reference**

## Benefits of Fresh Start
- ✅ **Fair competition** - Everyone starts equal
- ✅ **Monthly rewards** - Based on current month performance only
- ✅ **Clean slate** - No legacy data conflicts
- ✅ **Motivation** - Users can achieve rewards every month

## How to Use

### 1. Test First (Recommended)
```bash
cd subg-backend/scripts
node testMigration.js
```
This will show you exactly what will happen without making any changes.

### 2. Backup Your Database First!
```bash
# Option A: Using Node.js backup script (Recommended for Windows)
cd subg-backend
npm run backup

# Option B: Using MongoDB Compass (GUI)
# Download from: https://www.mongodb.com/try/download/compass
# Connect and export collections manually

# Option C: Using mongodump (if installed)
mongodump --uri="your_mongodb_connection_string" --out=./backup_before_migration
```

### 3. Run the Migration Script
```bash
cd subg-backend/scripts
node migrateToMonthlySystem.js
```

### 4. Verify Migration
```bash
# Check migration status in MongoDB
db.users.find({ migratedToMonthlySystem: true }).count()
```

## Expected Output

### Test Script Output:
```
🧪 Testing migration system (DRY RUN)...
✅ Database Connected to MongoDB
📊 Found 150 student users to analyze

📊 Current System Analysis:
============================

🏆 Current Level Distribution:
   Level 0: 45 users (30.0%)
   Level 1: 23 users (15.3%)
   Level 2: 18 users (12.0%)
   Level 3: 15 users (10.0%)
   Level 4: 12 users (8.0%)
   Level 5: 10 users (6.7%)
   Level 6: 8 users (5.3%)
   Level 7: 6 users (4.0%)
   Level 8: 4 users (2.7%)
   Level 9: 3 users (2.0%)
   Level 10: 6 users (4.0%)

📈 System Statistics:
   - Total users: 150
   - Total high-score quizzes across all users: 2,847
   - Average high-score quizzes per user: 19.0
   - Users with claimable rewards: 12
   - Total claimable rewards: ₹119,988

🔄 Migration Preview (What Would Happen):
==========================================
   - All users would be reset to Level 0
   - All monthly progress would start from 0
   - All claimable rewards would be reset to ₹0
   - All subscriptions would be reset to Free
   - Users would start fresh monthly competition

💰 Rewards Impact:
==================
   - Current total claimable rewards: ₹119,988
   - After migration: ₹0 (fresh start)
   - Monthly rewards: Top 3 users get ₹9,999 total in 3:2:1 ratio
     • 1st Place: ₹4,999
     • 2nd Place: ₹3,333
     • 3rd Place: ₹1,667

✅ Migration Readiness Check:
=============================
   - Users already migrated: 0
   - Users needing migration: 150
   - Migration status: 🟡 READY TO MIGRATE

🚀 To run migration:
   node migrateToMonthlySystem.js

🆕 New Monthly System After Migration:
=======================================
   - Level 0: Starter (0 quizzes)
   - Level 1: Rookie (2 quizzes)
   - Level 2: Explorer (6 quizzes)
   - Level 3: Thinker (12 quizzes)
   - Level 4: Strategist (20 quizzes)
   - Level 5: Achiever (30 quizzes)
   - Level 6: Mastermind (42 quizzes)
   - Level 7: Champion (56 quizzes)
   - Level 8: Prodigy (72 quizzes)
   - Level 9: Wizard (90 quizzes)
   - Level 10: Legend (110 quizzes)

🧪 Test completed successfully!
```

### Migration Script Output:
```
🔄 Starting FRESH START migration to monthly system...
⚠️  WARNING: This will reset ALL users to Level 0!
📊 Found 150 student users to reset and migrate
✅ User 123: RESET from Level 8 (256 old wins, ₹9,999 rewards, premium subscription) → Level 0 + Free (Fresh Start)
✅ User 456: RESET from Level 5 (64 old wins, ₹0 rewards, free subscription) → Level 0 + Free (Fresh Start)
✅ User 789: RESET from Level 10 (1024 old wins, ₹9,999 rewards, pro subscription) → Level 0 + Free (Fresh Start)
...

✅ FRESH START Migration completed successfully!
📊 Summary:
   - Total users: 150
   - Reset & Migrated: 150
   - Skipped (already migrated): 0

🎯 All users now start at Level 0 with monthly reset system!
📅 Monthly rewards will be based on fresh monthly performance only.

📈 Migration Statistics:
   - Users reset to Level 0: 150
   - All users now eligible for monthly rewards based on performance

🆕 New Monthly System:
   - Level 0: Starter (0 quizzes)
   - Level 1: Rookie (2 quizzes)
   - Level 2: Explorer (6 quizzes)
   - Level 3: Thinker (12 quizzes)
   - Level 4: Strategist (20 quizzes)
   - Level 5: Achiever (30 quizzes)
   - Level 6: Mastermind (42 quizzes)
   - Level 7: Champion (56 quizzes)
   - Level 8: Prodigy (72 quizzes)
   - Level 9: Wizard (90 quizzes)
   - Level 10: Legend (110 quizzes)

💰 Monthly Rewards: Top 3 users get ₹9,999 total in 3:2:1 ratio
```

## Post-Migration
- All users start at Level 0
- Monthly progress tracking begins immediately
- Users can start earning monthly rewards based on performance
- Old yearly system data is preserved in migration details for reference

## Rollback (If Needed)
If you need to rollback, you can restore from your backup:
```bash
mongorestore --uri="your_mongodb_connection_string" ./backup_before_migration
```

## Support
If you encounter any issues during migration, check the logs and ensure your database connection is stable.

## Files Created
- `migrateToMonthlySystem.js` - Main migration script
- `testMigration.js` - Test script to preview migration
- `README_MIGRATION.md` - This documentation file
