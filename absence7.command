# Se déplacer dans le dossier où se trouve ce script
cd "$(dirname "$0")"

echo "🚀 Démarrage de Absence7..."
echo "Le navigateur va s'ouvrir dans quelques instants..."

# Ouvre le navigateur (commande non-bloquante)
# "open" fonctionne sur macOS. Sur Linux ce serait "xdg-open".
open "http://localhost:3000"

# Lance le serveur
# On suppose que node/npm sont installés et disponibles dans le PATH de l'utilisateur
npm run dev
