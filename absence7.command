#!/bin/bash
cd /Users/thomas/Desktop/Projets/Absence7

echo "🚀 Démarrage de Absence7..."
echo "Le navigateur va s'ouvrir dans quelques instants..."

# Ouvre le navigateur (commande non-bloquante)
open "http://localhost:3000"

# Lance le serveur (bloquant, garde la fenêtre ouverte)
# Lance le serveur avec rechargement automatique (via nodemon)
# On utilise npm run dev qui est configuré dans package.json
# On s'assure d'utiliser le bon node/npm si possible, ou juste 'npm' s'il est dans le PATH
# Note: npm run dev requiert que npm soit dans le PATH ou accessible.
# Vu le path absolu précédent, on va essayer de déduire npm ou utiliser le PATH système.

export PATH=$PATH:/Users/thomas/.nvm/versions/node/v22.19.0/bin
npm run dev
