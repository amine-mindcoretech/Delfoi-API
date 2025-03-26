const express = require('express');
const { fetchSharePointItems, fetchRecentUpdatedItems } = require('../controllers/sharepointController');

const router = express.Router();

router.get('/sync', async (req, res) => {
    try {
        await fetchSharePointItems();
        res.status(200).json({ message: '✅ Données SharePoint synchronisées avec succès !' });
    } catch (error) {
        res.status(500).json({ error: '❌ Échec de la synchronisation.' });
    }
});

router.get('/sync-recent', async (req, res) => {
    try {
        await fetchRecentUpdatedItems();
        res.status(200).json({ message: '✅ Données modifiées ces 3 derniers jours mises à jour avec succès !' });
    } catch (error) {
        res.status(500).json({ error: '❌ Échec de la synchronisation récente.' });
    }
});

module.exports = router;
