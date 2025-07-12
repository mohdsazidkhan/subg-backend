const mongoose = require('mongoose');
const dotenv = require('dotenv');
// const cron = require('node-cron');
const OpenAI = require('openai');
const Subcategory = require('../models/Subcategory');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
dotenv.config();

// Configure your OpenAI API key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Robust MongoDB connection for production
async function connectToMongo() {
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 30000
      });
      console.log('MongoDB connected');
    } catch (err) {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    }
  }
}

async function generateQuizForSubcategory(subcat, level = 1) {
  const prompt = `Generate a quiz with 5 multiple-choice questions for the topic: ${subcat.name}. Each question should have 4 options and specify the correct answer. The quiz should be suitable for level ${level}. Return ONLY a JSON array in this format: [{"question": "...", "options": ["...","...","...","..."], "correctAnswerIndex": 0}, ...] with no explanation, no markdown, and no code block. Do not include any text before or after the JSON array.`;
  let response;
  try {
    response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000
    });
  } catch (err) {
    console.error('OpenAI API error:', err);
    return;
  }
  if (!response || !response.choices || !response.choices[0] || !response.choices[0].message || !response.choices[0].message.content) {
    console.error('OpenAI response missing expected structure:', response);
    return;
  }
  let quizData;
  let content = response.choices[0].message.content.trim();
  if (!content) {
    console.error('OpenAI returned empty content.');
    return;
  }
  // Remove markdown code block if present
  if (content.startsWith('```json')) {
    content = content.replace(/^```json\s*|```$/g, '');
  } else if (content.startsWith('```')) {
    content = content.replace(/^```\w*\s*|```$/g, '');
  }
  try {
    quizData = JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse OpenAI response:', e, '\nRaw content:', content);
    return;
  }
  if (!Array.isArray(quizData) || quizData.length === 0) {
    console.error('OpenAI response is not a valid non-empty array:', quizData);
    return;
  }
  // Create Quiz
  const quiz = await Quiz.create({
    title: `${subcat.name} Auto Quiz (Level ${level})`,
    category: subcat.category,
    subcategory: subcat._id,
    totalMarks: quizData.length,
    timeLimit: quizData.length * 2,
    description: `Auto-generated quiz for ${subcat.name} (Level ${level})`,
    isActive: true,
    difficulty: 'beginner',
    requiredLevel: level,
    recommendedLevel: level,
    levelRange: { min: 1, max: 10 },
    tags: [subcat.name]
  });
  // Create Questions
  for (const q of quizData) {
    await Question.create({
      quiz: quiz._id,
      questionText: q.question,
      options: q.options,
      correctAnswerIndex: q.correctAnswerIndex,
      timeLimit: 30
    });
  }
  console.log(`Quiz created for subcategory: ${subcat.name}`);
}

async function autoCreateQuizzes() {
  const subcategories = await Subcategory.find();
  // Find the lowest level for which not all subcategories have a quiz
  let targetLevel = null;
  for (let lvl = 1; lvl <= 10; lvl++) {
    let allHaveQuiz = true;
    for (const subcat of subcategories) {
      const quiz = await Quiz.findOne({ subcategory: subcat._id, requiredLevel: lvl });
      if (!quiz) {
        allHaveQuiz = false;
        break;
      }
    }
    if (!allHaveQuiz) {
      targetLevel = lvl;
      break;
    }
  }
  if (targetLevel) {
    let serial = 1;
    for (const subcat of subcategories) {
      const quiz = await Quiz.findOne({ subcategory: subcat._id, requiredLevel: targetLevel });
      if (!quiz) {
        try {
          await generateQuizForSubcategory(subcat, targetLevel);
          console.log(`Quiz created for subcategory: ${subcat.name} | Serial: ${serial} | Level: ${targetLevel}`);
        } catch (err) {
          console.error(`Failed to create quiz for ${subcat.name} (level ${targetLevel}):`, err.message);
        }
      }
      serial++;
    }
  } else {
    console.log('All levels 1-10 are already present for all subcategories.');
  }
}



// For manual run/testing
if (require.main === module) {
  (async () => {
    await connectToMongo();
    try {
      await autoCreateQuizzes();
      console.log('Auto quiz creation finished.');
    } catch (err) {
      console.error('Script error:', err);
    } finally {
      await mongoose.disconnect();
      process.exit(0);
    }
  })();
}
