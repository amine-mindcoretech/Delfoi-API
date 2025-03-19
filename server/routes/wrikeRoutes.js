// routes/wrikeRoutes.js

const express = require('express');
const { creationWrikeTableActive } = require('../controllers/wrikeController');
const { syncWrikeActive } = require('../controllers/wirkControllerUpdate');
const { createWrikeTableAnnuleTermine } = require('../controllers/wrikeControllerProjectsAnnulesTermines');
const { syncWrikeAnnuleTermineAndCleanActive } = require('../controllers/wrikeControllerUpdateAnnulesTermines');

const router = express.Router();

// API pour déclencher manuellement la récupération des données mises à jour
router.get('/creationWrikeTableActive', async (req, res) => {
    try {
        await creationWrikeTableActive();
        res.status(200).json({ message: "Données Wrike mises à jour avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la mise à jour des données Wrike." });
    }
});
// API pour déclencher manuellement la récupération de toutes les données
router.get('/syncWrikeActive', async (req, res) => {
    try {
        await syncWrikeActive();
        res.status(200).json({ message: "Toutes les données Wrike récupérées et stockées avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération de toutes les données Wrike." });
    }
});

// API pour synchroniser manuellement les projets
router.get('/syncWrikeAnnuleTermineAndCleanActive', async (req, res) => {
    try {
        await syncWrikeAnnuleTermineAndCleanActive();
        res.status(200).json({ message: "Synchronisation complète des projets Wrike avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la synchronisation des projets Wrike." });
    }
});


// API pour synchroniser manuellement les projets
router.get('/createWrikeTableAnnuleTermine', async (req, res) => {
    try {
        await createWrikeTableAnnuleTermine();
        res.status(200).json({ message: "Synchronisation complète des projets Wrike réussie." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la synchronisation des projets Wrike." });
    }
});

module.exports = router;