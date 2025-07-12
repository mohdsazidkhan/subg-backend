const OpenAI = require('openai');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.generateQuiz = async (req, res) => {
  try {
    const { category, subcategory, level } = req.body;
    if (!category || !subcategory || !level) {
      return res.status(400).json({ error: 'category, subcategory, and level are required' });
    }
    const subcat = await Subcategory.findById(subcategory);
    if (!subcat) return res.status(404).json({ error: 'Subcategory not found' });
    // Check if quiz already exists for this subcategory and level
    const existingQuiz = await Quiz.findOne({ subcategory, requiredLevel: level });
    if (existingQuiz) return res.status(400).json({ error: 'Quiz already exists for this subcategory and level' });

    const prompt = `Generate a quiz with 5 multiple-choice questions for the topic: ${subcat.name}. Each question should have 4 options and specify the correct answer. The quiz should be suitable for level ${level}. Return a JSON array of objects with keys: question, options (array), correctAnswerIndex (0-based).`;
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000
    });
    let quizData;
    try {
      quizData = JSON.parse(response.choices[0].message.content);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse OpenAI response', details: e.message });
    }
    // Create Quiz
    const quiz = await Quiz.create({
      title: `${subcat.name} Auto Quiz (Level ${level})`,
      category,
      subcategory,
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
    res.status(201).json({ message: 'Quiz and questions created', quizId: quiz._id });
  } catch (error) {
    console.error('Error in auto quiz:', error);
    res.status(500).json({ error: 'Failed to auto-create quiz', details: error.message });
  }
};
