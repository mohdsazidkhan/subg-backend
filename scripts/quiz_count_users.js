db.users.find({}, { _id: 1, email: 1 }).forEach(user => {
  
    const userId = user._id;
    const userEmail = user.email || "no-email@example.com";
  
    // Step 1: Count high-score attempts
    const highScoreCount = db.quizattempts.countDocuments({
      user: userId,
      scorePercentage: { $gte: 75 }
    });
  
    // Step 2: Count total attempts for accuracy
    const totalAttempts = db.quizattempts.countDocuments({ user: userId });
    const accuracy = totalAttempts > 0 ? Math.round((highScoreCount / totalAttempts) * 100) : 0;
  
    // Step 3: Get stored monthlyProgress
    const userDoc = db.users.findOne({ _id: userId }, { "monthlyProgress": 1 });
    const storedHighScore = userDoc?.monthlyProgress?.highScoreWins || 0;
    const storedAccuracy = userDoc?.monthlyProgress?.accuracy || 0;
  
    // Step 4: Update if mismatch found
    if (highScoreCount !== storedHighScore || accuracy !== storedAccuracy) {
      db.users.updateOne(
        { _id: userId },
        {
          $set: {
            "monthlyProgress.highScoreWins": highScoreCount,
            "monthlyProgress.accuracy": accuracy
          }
        }
      );
  
      print(`✅ Updated [${userEmail}]: highScoreWins=${highScoreCount}, accuracy=${accuracy}`);
    } else {
      print(`✔️ No update needed for [${userEmail}]`);
    }
  
  });
  