# SUBG Rewards Flow — Technical Docs

## 1) Prize Structure and Terms
- Level 6: Top 1–3 rank prize ₹990 (locked when conditions met)
- Level 9: Top 1–3 rank prize ₹9,980 (locked when conditions met)
- Level 10: Top 1–3 rank prize ₹99,999 split 3:2:1
- Unlock requirement: Level 10 Top 3 + 1024 high‑score quizzes (75%+) within 1 year
- Final payout = 3:2:1 share of ₹99,999 + Level 6 + Level 9 locked prizes

## 2) Flow Overview
1. User completes quizzes; level progression is based on best scores ≥ 75%.
2. On level‑up to 6 or 9, system checks if user is in Top 3 at that level.
3. If eligible, a locked reward is created (no duplicates).
4. On qualifying at Level 10 (Top 3) and reaching 1024 high‑score quizzes, all locked rewards are unlocked.
5. User claims unlocked rewards; only claiming adds amount to `claimableRewards`.
6. Daily CRON rechecks Level 10 for unlock eligibility.

## 3) Data Model (User)
```javascript
lockedRewards: [{
  level: Number,          // 6, 9, 10
  amount: Number,         // 990, 9980, 99999
  isUnlocked: Boolean,    // true when unlocked
  dateLocked: Date,
  dateUnlocked: Date,
  isClaimed: Boolean,
  dateClaimed: Date
}],
claimableRewards: Number, // Sum of claimed/unlocked amounts added on claim
totalQuizzesPlayed: Number // Count of high‑score quizzes (≥ 75%)
```

Notes:
- `totalQuizzesPlayed` mirrors high‑score quizzes and is updated from level progression code.

## 4) Locking Logic
- Trigger: Immediately after the level‑up that sets `level.currentLevel` to 6 or 9.
- Eligibility: User is currently in Top 3 for that level (sort by `level.averageScore` desc, then `level.highScoreQuizzes` desc).
- Idempotency: If reward for that level exists, do nothing.

Pseudocode (already implemented server‑side):
```js
if (newLevel === 6 || newLevel === 9) {
  if (isUserInTop3(userId, newLevel) && !hasLocked(newLevel)) {
    addLockedReward(newLevel, amount);
  }
}
```

## 5) Unlocking Logic
- Requirements: Level 10 Top 3 AND `totalQuizzesPlayed >= 1024`.
- Effect: All locked rewards are marked `isUnlocked = true` (no money added yet).
- Automation: Daily CRON at 02:00 IST computes Level 10 Top 3 and attempts unlock for each.

Important: Unlocking does NOT increase `claimableRewards`; only claiming does.

## 6) Claiming Logic
- Endpoint validates that reward exists, `isUnlocked === true`, and `isClaimed === false`.
- Sets `isClaimed = true`, `dateClaimed = now`, and increments `claimableRewards += amount`.

## 7) API Endpoints
User
- GET `/api/rewards/user/rewards` — Get locked/unlocked/claimed, quizProgress, canUnlock
- POST `/api/rewards/user/claim-reward` — Claim one unlocked reward `{ rewardId }`

Admin
- POST `/api/rewards/admin/process-level10-leaderboard` — Force Level 10 unlock processing
- POST `/api/rewards/lock-reward` — Admin‑only backfill lock `{ userId, level }` (6 or 9)
- GET `/api/rewards/admin/users?search&level&onlyLocked=1` — Paginated rewards overview per user

## 8) CRON Job
- Schedule: Daily 02:00 IST.
- Action: Query Level 10 Top 3 and call unlock for each; logs success/errors.

## 9) Frontend Integration
Student
- `RewardsDashboard` shows:
  - Quiz progress to 1024
  - Locked (L6/L9) with dates
  - Unlocked (claimable in UI)
  - Claimed history and running `claimableRewards`
- Terms visible: L6 ₹990, L9 ₹9,980, L10 ₹99,999 split 3:2:1, final payout includes L6/L9 once unlocked at L10.

Admin
- `Admin Rewards` page shows:
  - Totals per user (locked/unlocked/claimed), counts
  - `lockedLevels` list
  - Filters: search, level, `onlyLocked`

## 10) Security
- All user routes require JWT; a user only accesses their own rewards.
- Admin routes use `admin` middleware.
- Manual lock endpoint is admin‑only; normal locking happens automatically at level‑up.

## 11) Backfill Instructions (Mongo)
Preview Top 3 at Level 6
```javascript
db.users.find({ role: 'student', 'level.currentLevel': 6 }, { name:1,email:1,'level.averageScore':1,'level.highScoreQuizzes':1,lockedRewards:1 })
  .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
  .limit(3)
```
Backfill lock for these users (skip if already locked)
```javascript
const top = db.users.find({ role: 'student', 'level.currentLevel': 6 })
  .sort({ 'level.averageScore': -1, 'level.highScoreQuizzes': -1 })
  .limit(3).toArray();

top.forEach(u => {
  db.users.updateOne(
    { _id: u._id, 'lockedRewards.level': { $ne: 6 } },
    { $push: { lockedRewards: { level: 6, amount: 990, isUnlocked: false, dateLocked: new Date(), isClaimed: false } } }
  );
});
```
Repeat for Level 9 with `level: 9, amount: 9980`.

## 12) Testing Checklist
- Level‑up to 6 with two users on that level → both lock ₹990
- Level‑up to 9 with valid Top 3 → lock ₹9,980
- Level 10 Top 3 + 1024 quizzes → unlock all locked rewards (no claimable increment yet)
- Claim one unlocked reward → `claimableRewards` increases by amount; cannot re‑claim
- Admin list filters: `onlyLocked=1` returns only users with locked rewards
- CRON runs unlock without errors (log entries present)

## 13) Edge Cases
- Duplicate lock prevented per level.
- Unlock re‑runs are idempotent (already unlocked rewards stay unlocked).
- Users already at 6/9 before code rollout require backfill (admin or Mongo script).

## 14) Changelog (Recent)
- Unlock no longer adds to `claimableRewards`; only claim increments.
- CRON unlock now directly queries Level 10 Top 3 and calls unlock.
- Admin list shows `lockedLevels` and supports `onlyLocked=1`.
- Terms updated across UI to explicitly show L6/L9/L10 amounts and 3:2:1 rule.

---
Maintainer: SUBG Development Team

