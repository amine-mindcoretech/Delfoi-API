// routes/wrikeRoutes.js

const express = require('express');
const { fetchAndStoreWrikeData } = require('../controllers/wrikeController');
const { syncWrikeData } = require('../controllers/wirkControllerUpdate');

const router = express.Router();

// API pour déclencher manuellement la récupération des données mises à jour
router.get('/Fetch', async (req, res) => {
    try {
        await fetchAndStoreWrikeData();
        res.status(200).json({ message: "Données Wrike mises à jour avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la mise à jour des données Wrike." });
    }
});

// API pour déclencher manuellement la récupération de toutes les données
router.get('/syncWrikeData', async (req, res) => {
    try {
        await syncWrikeData();
        res.status(200).json({ message: "Toutes les données Wrike récupérées et stockées avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération de toutes les données Wrike." });
    }
});

module.exports = router;