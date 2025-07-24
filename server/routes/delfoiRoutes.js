// routes/delfoiRoutes.js
const express = require('express');
const { fetchAndStoreDelfoiData } = require('../controllers/delfoiController');
const { fetchAndStoreDelfoiSignatures } = require('../controllers/delfoiSignaturesController');
const notifyByEmail = require('../utils/sendErrorEmail');
const router = express.Router();

// Route pour tester l'API
router.get('/', (req, res) => {
    res.json({ message: "Bienvenue sur l'API Delfoi" });
});

// Route pour déclencher manuellement la récupération
router.get('/Fetch', async (req, res) => {
    try {
        await fetchAndStoreDelfoiData();
        res.status(200).json({ message: "Données récupérées et mises à jour avec succès !" });
    } catch (error) {
        await notifyByEmail(
            "❌ Échec de récupération Delfoi",
            `Une erreur est survenue dans /Fetch : ${error.message}`
        );
        res.status(500).json({ error: "Erreur lors de la récupération des données" });
    }
});

// Route manuelle pour signatures
router.get('/signatures', async (req, res) => {
    try {
        await fetchAndStoreDelfoiSignatures();
        res.status(200).json({ message: "Signatures mises à jour avec succès !" });
    } catch (error) {
        await notifyByEmail(
            "❌ Échec de mise à jour des signatures Delfoi",
            `Une erreur est survenue dans /signatures : ${error.message}`
        );
        res.status(500).json({ error: "Erreur lors de la mise à jour des signatures." });
    }
});


module.exports = router;
