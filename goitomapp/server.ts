import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("goitom.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('admin', 'employee')),
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    employee_name TEXT,
    provider_name TEXT,
    bread_count INTEGER,
    cash_amount REAL DEFAULT 0,
    image_url TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Seed Admin if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!adminExists) {
  db.prepare("INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)").run(
    "admin@goitom.com",
    "admin123", // In production, use bcrypt
    "admin",
    "Administrator"
  );
}

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = 3000;

// API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Auth Routes
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password);
  if (user) {
    res.json({ id: user.id, email: user.email, role: user.role, name: user.name });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.post("/api/signup", (req, res) => {
  const { email, password, name, role = 'employee' } = req.body;
  try {
    const result = db.prepare("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)").run(email, password, name, role);
    res.json({ id: result.lastInsertRowid, email, name, role });
  } catch (e) {
    res.status(400).json({ error: "Email already exists" });
  }
});

// Record Routes
app.post("/api/records", async (req, res) => {
  const { userId, employeeName, providerName, imageBase64, cashAmount = 0 } = req.body;
  
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Gemini API key not configured" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // AI Bread Counting
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: "Count the number of breads in this image. Return ONLY the integer number. If no bread is found, return 0." },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64.split(',')[1]
              }
            }
          ]
        }
      ]
    });

    const countText = response.text?.trim() || "0";
    const breadCount = parseInt(countText.replace(/[^0-9]/g, '')) || 0;

    // Save record
    const result = db.prepare(`
      INSERT INTO records (user_id, employee_name, provider_name, bread_count, cash_amount, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, employeeName, providerName, breadCount, cashAmount, imageBase64);

    res.json({ id: result.lastInsertRowid, breadCount });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "Failed to process image" });
  }
});

app.get("/api/records", (req, res) => {
  const { userId, role } = req.query;
  let records;
  if (role === 'admin') {
    records = db.prepare("SELECT * FROM records ORDER BY timestamp DESC").all();
  } else {
    records = db.prepare("SELECT * FROM records WHERE user_id = ? ORDER BY timestamp DESC").all(userId);
  }
  res.json(records);
});

// Admin Routes
app.get("/api/users", (req, res) => {
  const users = db.prepare("SELECT id, email, name, role FROM users WHERE role != 'admin'").all();
  res.json(users);
});

app.put("/api/profile", (req, res) => {
  const { id, email, name, password } = req.body;
  try {
    if (password) {
      db.prepare("UPDATE users SET email = ?, name = ?, password = ? WHERE id = ?").run(email, name, password, id);
    } else {
      db.prepare("UPDATE users SET email = ?, name = ? WHERE id = ?").run(email, name, id);
    }
    const user = db.prepare("SELECT id, email, name, role FROM users WHERE id = ?").get(id);
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: "Email já existe ou erro ao atualizar" });
  }
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ success: true });
});

app.get("/api/stats", (req, res) => {
  const totalByDay = db.prepare(`
    SELECT date(timestamp) as date, SUM(bread_count) as total, SUM(cash_amount) as total_cash
    FROM records
    GROUP BY date(timestamp)
    ORDER BY date DESC
    LIMIT 7
  `).all();

  const totalByEmployee = db.prepare(`
    SELECT employee_name, SUM(bread_count) as total, SUM(cash_amount) as total_cash
    FROM records
    GROUP BY employee_name
    ORDER BY total DESC
  `).all();

  res.json({ totalByDay, totalByEmployee });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    // SPA fallback for production
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
