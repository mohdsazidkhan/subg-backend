const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateQuestions(topic, numQuestions = 10) {
  const prompt = `Generate ${numQuestions} multiple choice questions (MCQs) for students on "${topic}". 
Each question should include:
- questionText
- 4 options
- correct answer index (0-based)

Return it in JSON format like this:
[
  {
    "questionText": "...",
    "options": ["...", "...", "...", "..."],
    "correctAnswerIndex": 2
  },
  ...
]`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0].message.content;
  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch (err) {
    console.error("Failed to parse OpenAI response:", err);
    throw new Error("Invalid OpenAI JSON format");
  }
}

module.exports = { generateQuestions };
