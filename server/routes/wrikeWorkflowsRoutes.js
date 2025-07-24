//wrikeWorkflowsRoutes.js
const express = require('express');
const { fetchAndStoreWrikeWorkflows } = require('../controllers/wrikeWorkflowsController');
const notifyByEmail = require('../utils/sendErrorEmail');

const router = express.Router();

// 🚀 Route pour récupérer et stocker les workflows Wrike
router.get('/FetchWrikeWorkflows', async (req, res) => {
    try {
        await fetchAndStoreWrikeWorkflows();
        res.status(200).json({ message: "Workflows Wrike mis à jour avec succès." });
    } catch (error) {
        await notifyByEmail(
            '❌ Erreur - FetchWrikeWorkflows',
            `Une erreur est survenue dans /FetchWrikeWorkflows : ${error.message}`
        );
        res.status(500).json({ error: "❌ Erreur lors de la mise à jour des workflows Wrike." });
    }
});

module.exports = router;
