# SUBG QUIZ - Annual Rewards System

## Overview

The annual rewards system implements a three-phase reward flow for Level 6, Level 9, and Level 10 users using cron jobs and the existing leaderboard logic. This system replaces the previous immediate reward locking with scheduled annual processing.

## 🎯 Reward Phases

### Phase 1: August 1 - Level 6 Rewards Locking
- **Date**: August 1st at 12:00 AM IST
- **Target**: Top 3 users who completed Level 6 before August 1
- **Reward**: ₹990 locked per user
- **Criteria**: 
  - `level6.completed === true`
  - `level6.completedAt <= '2025-08-01'`
  - Top 3 based on leaderboard logic (averageScore + highScoreQuizzes)

### Phase 2: December 1 - Level 9 Rewards Locking
- **Date**: December 1st at 12:00 AM IST
- **Target**: Top 3 users who completed Level 9 before December 1
- **Reward**: ₹9,980 locked per user
- **Criteria**:
  - `level9.completed === true`
  - `level9.completedAt <= '2025-12-01'`
  - Top 3 based on leaderboard logic (averageScore + highScoreQuizzes)

### Phase 3: March 31 - Level 10 Rewards Unlocking
- **Date**: March 31st at 12:00 AM IST
- **Target**: Top 3 users who completed Level 10 before March 31
- **Rewards**:
  - All locked rewards unlocked and added to `claimableRewards`
  - Level 10 pool share from ₹99,999:
    - Rank 1: ₹49,999.50
    - Rank 2: ₹33,333.00
    - Rank 3: ₹16,666.50
- **Criteria**:
  - `level10.completed === true`
  - `level10.completedAt <= '2026-03-31'`
  - `totalQuizzesPlayed >= 1024`
  - Top 3 based on leaderboard logic

## 🏗️ Implementation Details

### New User Schema Fields
```javascript
// Level completion tracking for annual rewards
level6: {
  completed: { type: Boolean, default: false },
  completedAt: { type: Date }
},
level9: {
  completed: { type: Boolean, default: false },
  completedAt: { type: Date }
},
level10: {
  completed: { type: Boolean, default: false },
  completedAt: { type: Date }
}
```

### Key Features
- **No Duplicate Rewards**: System checks for existing locked rewards before creating new ones
- **Retroactive Eligibility**: Users who completed levels before the lock dates are still eligible
- **Automatic Level Tracking**: Level completion is automatically tracked when users reach new levels
- **Cron Job Scheduling**: Uses node-cron for precise timing (IST timezone)
- **Existing Logic Reuse**: Leverages existing leaderboard sorting and Top 3 logic

## 🚀 Setup and Usage

### 1. Database Migration
Run the population script to set level completion fields for existing users:
```bash
cd subg-backend
node scripts/populateLevelCompletion.js
```

### 2. Manual Testing
Test individual phases manually:
```bash
# Test Phase 1 (Level 6 locking)
node scripts/annualRewards.js phase1

# Test Phase 2 (Level 9 locking)
node scripts/annualRewards.js phase2

# Test Phase 3 (Level 10 unlocking)
node scripts/annualRewards.js phase3
```

### 3. Automatic Scheduling
The system automatically schedules cron jobs when the server starts:
- **August 1**: Level 6 rewards locking
- **December 1**: Level 9 rewards locking  
- **March 31**: Level 10 rewards unlocking

## 📊 Leaderboard Logic

The system uses the existing leaderboard logic to determine Top 3 users:

```javascript
.sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
.limit(3)
```

This ensures consistency with the existing leaderboard system and maintains fair ranking based on:
1. **Average Score** (descending)
2. **High Score Quizzes Count** (descending)

## 🔒 Reward States

### Locked Rewards
```javascript
{
  level: 6,           // or 9
  amount: 990,        // or 9980
  isUnlocked: false,
  dateLocked: ISODate("2025-08-01")  // or "2025-12-01"
}
```

### Unlocked Rewards
When Phase 3 runs, rewards are marked as unlocked and amounts are added to `claimableRewards`:
```javascript
{
  level: 6,
  amount: 990,
  isUnlocked: true,
  dateLocked: ISODate("2025-08-01"),
  dateUnlocked: ISODate("2026-03-31")
}
```

## ⚠️ Important Notes

### Reward Eligibility
- **Level 6 & 9**: Rewards are NOT locked when levels are reached
- **Level 6 & 9**: Rewards are only locked on August 1 and December 1 respectively
- **Level 10**: Rewards unlock only on March 31 for Top 3 users with 1024+ quizzes

### User Progression
- Users can progress beyond Level 6/9 and still receive rewards if they completed those levels before the lock dates
- Users already at Level 10 can still receive Level 6 and Level 9 rewards if they completed those levels before the respective lock dates

### Quiz Requirements
- `totalQuizzesPlayed` represents high-score quizzes (75% or higher) only
- Level 10 rewards require exactly 1024 high-score quizzes
- This ensures rewards are based on quality performance, not just quantity

## 🔧 Troubleshooting

### Common Issues
1. **Cron Jobs Not Running**: Check timezone settings and server logs
2. **Rewards Not Locking**: Verify level completion fields are populated
3. **Duplicate Rewards**: System prevents duplicates, but check for data inconsistencies

### Logs
The system provides detailed logging for each phase:
- Phase start/completion messages
- Individual user processing results
- Error handling and recovery

### Manual Override
If needed, rewards can be manually processed using the script commands listed above.

## 📅 Annual Schedule Summary

| Date | Phase | Action | Target Level | Amount |
|------|-------|---------|--------------|---------|
| Aug 1 | Phase 1 | Lock | Level 6 | ₹990 |
| Dec 1 | Phase 2 | Lock | Level 9 | ₹9,980 |
| Mar 31 | Phase 3 | Unlock | Level 10 | All + ₹99,999 pool |

## 🔄 Integration with Existing Systems

- **Leaderboard**: Uses existing sorting and ranking logic
- **User Levels**: Integrates with existing level progression system
- **Rewards**: Extends existing lockedRewards schema
- **Cron Jobs**: Replaces daily rewards processing with annual scheduling
- **Quiz Completion**: Automatically tracks level completion during quiz attempts

This system maintains backward compatibility while implementing the new annual reward flow as specified in the requirements.
