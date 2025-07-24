// routes/wrikeRoutes.js


const express = require('express');
const { fetchAndStoreWrikeData } = require('../controllers/wrikeController');
const { syncWrikeData } = require('../controllers/wirkControllerUpdate');
const { createWrikeTableAnnuleTermine } = require('../controllers/wrikeControllerProjectsAnnulesTermines');
const { syncWrikeAnnuleTermineAndCleanActive } = require('../controllers/wrikeControllerUpdateAnnulesTermines');
const notifyByEmail = require('../utils/sendErrorEmail');
const router = express.Router();

// API pour déclencher manuellement la récupération des données mises à jour
router.get('/syncWrikeData', async (req, res) => {
    try {
        await fetchAndStoreWrikeData();
        res.status(200).json({ message: "Données Wrike mises à jour avec succès." });
    } catch (error) {
        await notifyByEmail(
            '❌ Erreur - creationWrikeTableActive',
            `Une erreur est survenue dans /syncWrikeData : ${error.message}`
        );
        res.status(500).json({ error: "❌ Erreur lors de la mise à jour des données Wrike." });
    }
});

// API pour déclencher manuellement la récupération de toutes les données
router.get('/FetchActive', async (req, res) => {
    try {
        await syncWrikeData();
        res.status(200).json({ message: "Toutes les données Wrike récupérées et stockées avec succès." });
    } catch (error) {
        await notifyByEmail(
            '❌ Erreur - syncWrikeActive',
            `Une erreur est survenue dans /FetchActive : ${error.message}`
        );
        res.status(500).json({ error: "❌ Erreur lors de la récupération de toutes les données Wrike." });
    }
});
// API pour synchroniser manuellement les projets
router.get('/FetchAnnuleTermineAndCleanActive', async (req, res) => {
    try {
        await syncWrikeAnnuleTermineAndCleanActive();
        res.status(200).json({ message: "Synchronisation complète des projets Wrike avec succès." });
    } catch (error) {
        await notifyByEmail(
            '❌ Erreur - syncWrikeAnnuleTermineAndCleanActive',
            `Une erreur est survenue dans /FetchAnnuleTermineAndCleanActive : ${error.message}`
        );
        res.status(500).json({ error: "❌ Erreur lors de la synchronisation des projets Wrike." });
    }
});


// API pour synchroniser manuellement les projets
router.get('/createWrikeTableAnnuleTermine', async (req, res) => {
    try {
        await createWrikeTableAnnuleTermine();
        res.status(200).json({ message: "Synchronisation complète des projets Wrike réussie." });
    } catch (error) {
        await notifyByEmail(
            '❌ Erreur - createWrikeTableAnnuleTermine',
            `Une erreur est survenue dans /createWrikeTableAnnuleTermine : ${error.message}`
        );
        res.status(500).json({ error: "❌ Erreur lors de la création de la table projets Wrike." });
    }
});
module.exports = router;