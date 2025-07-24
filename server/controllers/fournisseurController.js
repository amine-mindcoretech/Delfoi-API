const fournisseurModel = require('../models/fournisseurModel');

const fournisseurController = {
  async createTable(req, res) {
    try {
      const result = await fournisseurModel.createTable();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async syncData(req, res) {
    try {
      const result = await fournisseurModel.syncData();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async downloadCSV(req, res) {
    try {
      const csv = await fournisseurModel.downloadCSV();

      // Définir les en-têtes pour un fichier CSV téléchargeable
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=fournisseurgenius_import.csv');

      // Envoyer le contenu CSV (le BOM est déjà inclus dans csv)
      res.send(csv);
    } catch (error) {
      // Vérifier si les en-têtes ont déjà été envoyés avant d'envoyer une réponse d'erreur
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: error.message });
      } else {
        console.error('Error after headers sent:', error.message);
      }
    }
  },

  async dropTable(req, res) {
    try {
      const result = await fournisseurModel.dropTable();
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = fournisseurController;