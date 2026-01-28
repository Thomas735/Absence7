#!/bin/bash

# Script de sauvegarde automatique pour Absence7
# À exécuter manuellement ou via cron

# --- CONFIGURATION ---
SOURCE="/Users/thomas/Desktop/Projets/Absence7"
DEST="/Users/thomas/SauvegardesSite"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="$DEST/sauvegarde.log"

# --- FONCTIONS ---
log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# --- VÉRIFICATIONS ---
log_message "Début de la sauvegarde..."

# Vérifier que le dossier source existe
if [ ! -d "$SOURCE" ]; then
    log_message "ERREUR: Dossier source introuvable: $SOURCE"
    exit 1
fi

# Créer le dossier de destination si nécessaire
mkdir -p "$DEST"
if [ $? -ne 0 ]; then
    log_message "ERREUR: Impossible de créer le dossier de destination: $DEST"
    exit 1
fi

# --- SAUVEGARDE ---
log_message "Création de la sauvegarde: $DATE"

# Créer le dossier de sauvegarde
mkdir -p "$DEST/$DATE"
if [ $? -ne 0 ]; then
    log_message "ERREUR: Impossible de créer le dossier de sauvegarde: $DEST/$DATE"
    exit 1
fi

# Copier les fichiers (avec rsync pour plus de fiabilité)
rsync -av --exclude='node_modules' --exclude='.git' "$SOURCE/" "$DEST/$DATE/"
if [ $? -eq 0 ]; then
    log_message "Sauvegarde réussie: $SOURCE → $DEST/$DATE"
else
    log_message "ERREUR: Échec de la copie des fichiers"
    exit 1
fi

# --- NETTOYAGE DES ANCIENNES SAUVEGARDES ---
log_message "Nettoyage des sauvegardes de plus de 30 jours..."
find "$DEST" -maxdepth 1 -type d -name "20*" -mtime +30 -exec rm -rf {} \; 2>/dev/null

# --- RAPPORT FINAL ---
BACKUP_COUNT=$(find "$DEST" -maxdepth 1 -type d -name "20*" | wc -l)
TOTAL_SIZE=$(du -sh "$DEST" | cut -f1)

log_message "Sauvegarde terminée avec succès!"
log_message "Nombre de sauvegardes: $BACKUP_COUNT"
log_message "Espace total utilisé: $TOTAL_SIZE"
log_message "Emplacement: $DEST"