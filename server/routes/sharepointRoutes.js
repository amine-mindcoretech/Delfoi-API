const express = require('express');
const { fetchSharePointItems, fetchRecentUpdatedItems } = require('../controllers/sharepointController');
const notifyByEmail = require('../utils/sendErrorEmail');

const router = express.Router();

router.get('/sync', async (req, res) => {
    try {
        await fetchSharePointItems();
        res.status(200).json({ message: '✅ Données SharePoint synchronisées avec succès !' });
    } catch (error) {
        await notifyByEmail(
            '❌ Échec de la synchronisation SharePoint',
            `Une erreur est survenue dans /sync : ${error.message}`
        );
        res.status(500).json({ error: '❌ Échec de la synchronisation.' });
    }
});

router.get('/FetchTbl_CaptureInventaire', async (req, res) => {
    try {
        await fetchRecentUpdatedItems();
        res.status(200).json({ message: '✅ Données modifiées ces 3 derniers jours mises à jour avec succès !' });
    } catch (error) {
        await notifyByEmail(
            '❌ Échec de la synchronisation récente SharePoint',
            `Une erreur est survenue dans /FetchTbl_CaptureInventaire : ${error.message}`
        );
        res.status(500).json({ error: '❌ Échec de la synchronisation récente.' });
    }
});

module.exports = router;
