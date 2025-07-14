// Script to auto-create quizzes for every subcategory, every level, and every difficulty using OpenAI
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const Quiz = require('../models/Quiz');
const Subcategory = require('../models/Subcategory');
const Category = require('../models/Category');
const Question = require('../models/Question');
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'];
const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1); // Levels 1-10

async function generateQuizQuestions(subcat, level, difficulty) {
  const prompt = `Generate a quiz with 5 multiple-choice questions for the topic: ${subcat.name}. Each question should have 4 options and specify the correct answer. The quiz should be suitable for level ${level} and difficulty ${difficulty}. Return ONLY a JSON array in this format: [{"question": "...", "options": ["...","...","...","..."], "correctAnswerIndex": 0}, ...] with no explanation, no markdown, and no code block. Do not include any text before or after the JSON array.`;
  let response;
  try {
    response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000
    });
  } catch (err) {
    console.error('OpenAI API error:', err);
    return null;
  }
  if (!response || !response.choices || !response.choices[0] || !response.choices[0].message || !response.choices[0].message.content) {
    console.error('OpenAI response missing expected structure:', response);
    return null;
  }
  let quizData;
  let content = response.choices[0].message.content.trim();
  if (!content) {
    console.error('OpenAI returned empty content.');
    return null;
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
    return null;
  }
  if (!Array.isArray(quizData) || quizData.length === 0) {
    console.error('OpenAI response is not a valid non-empty array:', quizData);
    return null;
  }
  return quizData;
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const subcategories = await Subcategory.find().populate('category');

    for (const subcat of subcategories) {
      let quizSerial = 1;
      for (const level of LEVELS) {
        for (const difficulty of DIFFICULTIES) {
          try {
            const exists = await Quiz.findOne({
              subcategory: subcat._id,
              requiredLevel: level,
              difficulty
            });
            if (!exists) {
              let quizData;
              try {
                quizData = await generateQuizQuestions(subcat, level, difficulty);
              } catch (err) {
                console.error(`OpenAI error for ${subcat.name} - Level ${level} - ${difficulty}:`, err);
                continue;
              }
              if (!quizData) {
                console.log(`No questions generated for ${subcat.name} - Level ${level} - ${difficulty}`);
                continue;
              }
              let quiz;
              try {
                quiz = await Quiz.create({
                  title: `${subcat.name} - Level ${level} Quiz`,
                  category: subcat.category._id,
                  subcategory: subcat._id,
                  requiredLevel: level,
                  recommendedLevel: level,
                  difficulty,
                  totalMarks: quizData.length,
                  timeLimit: quizData.length * 2,
                  description: `Auto-generated quiz for ${subcat.name}, Level ${level}, Difficulty: ${difficulty}`,
                  isActive: true
                });
              } catch (err) {
                console.error(`Quiz creation error for ${subcat.name} - Level ${level} - ${difficulty}:`, err);
                continue;
              }
              for (const q of quizData) {
                try {
                  await Question.create({
                    quiz: quiz._id,
                    questionText: q.question,
                    options: q.options,
                    correctAnswerIndex: q.correctAnswerIndex,
                    timeLimit: 30,
                    difficulty
                  });
                } catch (err) {
                  console.error(`Question creation error for quiz ${quiz._id}:`, err);
                }
              }
              console.log(`Created quiz: ${quiz.title} | Level: ${level} | Serial: ${quizSerial}`);
              quizSerial++;
            } else {
              console.log(`Exists: ${subcat.name} - Level ${level} - ${difficulty}`);
            }
          } catch (err) {
            console.error(`Error in loop for ${subcat.name} - Level ${level} - ${difficulty}:`, err);
          }
        }
      }
    }
    await mongoose.disconnect();
    console.log('Done!');
  } catch (err) {
    console.error('Fatal error in main():', err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
