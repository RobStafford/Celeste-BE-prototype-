import 'dotenv/config';
import express from "express";
import rateLimit from "express-rate-limit";
import Database from "better-sqlite3";

const app = express();
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// ---- SQLite setup ----
const dbPath = process.env.SQLITE_FILE || "./leaderboard.db";
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_leaderboard_score
    ON leaderboard (score DESC, created_at ASC);
`);

const insertStmt = db.prepare(
  "INSERT INTO leaderboard (player, score) VALUES (?, ?)"
);
const top10Stmt = db.prepare(
  "SELECT player, score, created_at FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT 10"
);

// ---- Routes ----
app.get("/api/scores", (_req, res) => {
  const rows = top10Stmt.all();
  res.json(rows);
});

app.post("/api/scores", (req, res) => {
  let { player, score } = req.body ?? {};
  // basic validation & normalization
  if (typeof player !== "string") player = String(player ?? "");
  player = player.trim().slice(0, 3);
  const nScore = Number(score);

  if (!player) return res.status(400).json({ error: "player required" });
  if (!Number.isFinite(nScore) || nScore < 0 || nScore > 1e9)
    return res.status(400).json({ error: "invalid score" });

  insertStmt.run(player, Math.floor(nScore));
  res.status(201).end();
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 3000, () => {
  console.log("Score server listening");
});
