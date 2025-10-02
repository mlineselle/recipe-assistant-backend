const express = require("express");
const cors = require("cors");
const functions = require("firebase-functions");
const rateLimit = require("express-rate-limit");
const {GoogleGenAI} = require("@google/genai");
const admin = require("firebase-admin");

admin.initializeApp();
const app = express();

app.set("trust proxy", 1);

const allowedOrigins = [
  "https://recipe-assistant-719fe.web.app",
  "http://localhost:5173",
];

app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {error: "Too many requests, please try again later."},
});
app.use(limiter);

app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({error: "Missing or invalid auth token"});
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({error: "Invalid auth token"});
  }
});

const client = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

app.post("/extract", async (req, res) => {
  const {url} = req.body;
  if (!url) return res.status(400).json({error: "No URL provided"});

  try {
    const response = await fetch(url);
    const html = await response.text();

    const completion = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents:
        // eslint-disable-next-line max-len
        "Extract a title, times(prep, cook, and total) in minutes, ingredients and instructions from this recipe website html :" + html,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: {type: "string"},
            times: {
              type: "object",
              properties: {
                prep: {type: "number"},
                cook: {type: "number"},
                total: {type: "number"},
              },
              required: ["total"],
            },
            ingredients: {
              type: "array",
              items: {
                type: "string",
              },
            },
            instructions: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
          propertyOrdering: ["title", "times", "ingredients", "instructions"],
        },
      },
    });

    const data = JSON.parse(completion.text);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Failed to extract recipe"});
  }
});

exports.api = functions.https.onRequest(app);
