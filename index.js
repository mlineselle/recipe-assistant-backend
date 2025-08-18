import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json()); // parse JSON requests

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/extract", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  try {
    // 1️⃣ Fetch the webpage
    const response = await fetch(url);
    const html = await response.text();

    // 2️⃣ Call AI API to extract recipe info
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Extract ingredients and instructions from recipes. Return JSON with {ingredients: [], instructions: []}",
        },
        {
          role: "user",
          content: html,
        },
      ],
    });

    // 3️⃣ Parse AI response and send to frontend
    const data = JSON.parse(completion.choices[0].message.content);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to extract recipe" });
  }
});

app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`)
);
