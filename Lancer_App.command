#!/bin/bash
cd /Users/thomas/Desktop/Projets/Absence7

echo "🚀 Démarrage de Absence7..."
echo "Le navigateur va s'ouvrir dans quelques instants..."

# Ouvre le navigateur (commande non-bloquante)
open "http://localhost:3000"

# Lance le serveur (bloquant, garde la fenêtre ouverte)
/Users/thomas/.nvm/versions/node/v22.19.0/bin/node server.js
