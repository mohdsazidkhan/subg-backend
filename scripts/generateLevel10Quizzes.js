const mongoose = require('mongoose');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const Subcategory = require('../models/Subcategory');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');

dotenv.config();

// ✅ Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ Connect to MongoDB
async function connectToMongo() {
  console.log("🔗 Connecting to MongoDB...");
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 30000
      });
      console.log('✅ MongoDB connected');
    } catch (err) {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    }
  }
}

// ✅ Generate one quiz with unique questions for a subcategory
async function generateQuizForLevel10(subcat) {
  console.log(`🧠 Generating Level 10 quiz for "${subcat.name}"...`);

  const prompt = `Generate 5 advanced-level multiple-choice questions for the topic "${subcat.name}".
Each question must have:
- 4 unique options
- One correct answer
- High difficulty (Level 10)
- Accurate and factual content

Return ONLY a JSON array like:
[{"question": "...", "options": ["...","...","...","..."], "correctAnswerIndex": 0}]
No markdown, no explanation.`;

  let response;
  try {
    response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7
    });
  } catch (err) {
    console.error(`❌ OpenAI API error for ${subcat.name}:`, err);
    return;
  }

  let content = response.choices?.[0]?.message?.content?.trim();
  if (!content) {
    console.error(`❌ Empty response for ${subcat.name}`);
    return;
  }

  if (content.startsWith('```json')) {
    content = content.replace(/^```json\s*|```$/g, '');
  } else if (content.startsWith('```')) {
    content = content.replace(/^```\w*\s*|```$/g, '');
  }

  let quizData;
  try {
    quizData = JSON.parse(content);
  } catch (e) {
    console.error(`❌ Failed to parse JSON for ${subcat.name}:`, e.message, '\nRaw Content:', content);
    return;
  }

  if (!Array.isArray(quizData) || quizData.length === 0) {
    console.error(`❌ Invalid quiz array for ${subcat.name}`);
    return;
  }

  // ✅ Get all existing questions in subcategory to avoid duplicates
  const existingQuestions = await Question.find({
    quiz: { $in: await Quiz.find({ subcategory: subcat._id }).distinct('_id') }
  }).distinct('questionText');

  // ✅ Filter out duplicate questions
  const filtered = quizData.filter(q =>
    q.question &&
    q.options?.length === 4 &&
    typeof q.correctAnswerIndex === 'number' &&
    !existingQuestions.includes(q.question.trim())
  );

  if (filtered.length === 0) {
    console.warn(`⚠️ All generated questions were duplicates for ${subcat.name}`);
    return;
  }

  // ✅ Create new quiz
  const quiz = await Quiz.create({
    title: `${subcat.name} - Advanced Quiz (Level 10)}`,
    category: subcat.category,
    subcategory: subcat._id,
    totalMarks: filtered.length,
    timeLimit: filtered.length * 2,
    description: `Auto-generated advanced quiz for ${subcat.name} (Level 10)`,
    isActive: true,
    difficulty: 'expert',
    requiredLevel: 10,
    recommendedLevel: 10,
    levelRange: { min: 10, max: 10 },
    tags: [subcat.name, 'advanced', 'level10']
  });

  // ✅ Add questions
  for (const q of filtered) {
    await Question.create({
      quiz: quiz._id,
      questionText: q.question.trim(),
      options: q.options,
      correctAnswerIndex: q.correctAnswerIndex,
      timeLimit: 45
    });
  }

  console.log(`✅ Created new quiz for "${subcat.name}" with ${filtered.length} questions.`);
}

// ✅ Main runner: Loop all subcategories
async function generateLevel10QuizzesForAll() {
  console.log("📚 Fetching all subcategories...");
  const subcategories = await Subcategory.find();

  if (!subcategories.length) {
    console.log("⚠️ No subcategories found in the database.");
    return;
  }

  let count = 1;
  for (const subcat of subcategories) {
    console.log(`\n🔄 (${count}/${subcategories.length}) Processing: ${subcat.name}`);
    await generateQuizForLevel10(subcat);
    count++;
  }

  console.log("\n🎯 All subcategories processed.");
}

// ✅ Run if script is executed directly
if (require.main === module) {
  console.log("🚀 Starting Level 10 Quiz Generator...");
  (async () => {
    await connectToMongo();
    try {
      await generateLevel10QuizzesForAll();
      console.log('✅ Script completed successfully!');
    } catch (err) {
      console.error('❌ Script error:', err);
    } finally {
      await mongoose.disconnect();
      process.exit(0);
    }
  })();
}
