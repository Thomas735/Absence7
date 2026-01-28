const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const SECRET_KEY = "SECRET_KEY_A_CHANGER_EN_PROD"; // In a real app, use environment variable

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "front")));

// --- DATA & STORAGE SETUP ---
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const STORAGE_DIR = path.join(DATA_DIR, "storage");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");

// --- HELPER FUNCTIONS ---
function getUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getUserDataFile(username) {
  // Sanitize username to be safe for filesystem
  const safeName = username.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  return path.join(STORAGE_DIR, `${safeName}.json`);
}

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Non connecté" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Session invalide" });
    req.user = user;
    next();
  });
};

// --- AUTH ENDPOINTS ---

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Champs manquants" });

    const users = getUsers();
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: "Utilisateur déjà existant" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now().toString(), username, password: hashedPassword };

    users.push(newUser);
    saveUsers(users);

    // Auto-login after register
    const token = jwt.sign({ username: newUser.username }, SECRET_KEY, { expiresIn: '30d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days

    res.json({ success: true, username: newUser.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = getUsers();
    const user = users.find(u => u.username === username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Identifiants incorrects" });
    }

    const token = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: '30d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.json({ success: true, username: user.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Check Session
app.get("/api/auth/me", (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.json({ loggedIn: false });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.json({ loggedIn: false });
    res.json({ loggedIn: true, username: user.username });
  });
});


// --- DATA ENDPOINTS (PROTECTED) ---

// Save
app.post("/api/save", authenticateToken, (req, res) => {
  try {
    const data = req.body;
    const filePath = getUserDataFile(req.user.username);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 Données sauvegardées pour ${req.user.username}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur sauvegarde:", err);
    res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  }
});

// Load
app.get("/api/load", authenticateToken, (req, res) => {
  const filePath = getUserDataFile(req.user.username);

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, "utf8");
      res.json(JSON.parse(data));
    } catch (err) {
      console.error("Erreur chargement:", err);
      res.status(500).json({ error: "Erreur lors du chargement" });
    }
  } else {
    res.json({ empty: true });
  }
});

// Route pour toutes les requêtes (SPA fallback)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "front", "index.html"));
});

// Configuration du port
const PORT = process.env.PORT || 3000;

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});