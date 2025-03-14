const express = require('express');
const { fetchAndStoreWrikeData } = require('../controllers/wrikeController');

const router = express.Router();

// API pour déclencher manuellement la récupération
router.get('/Fetch', async (req, res) => {
    try {
        await fetchAndStoreWrikeData();
        res.status(200).json({ message: "Données Wrike mises à jour avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la mise à jour des données Wrike." });
    }
});

module.exports = router;
