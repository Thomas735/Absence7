const express = require("express");
const path = require("path");

const app = express();

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, "front")));

// Route pour toutes les requêtes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "front", "index.html"));
});

// Configuration du port
const PORT = process.env.PORT || 3000;

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});