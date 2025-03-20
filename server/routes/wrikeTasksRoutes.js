//wrikeTasksRoutes.js
const express = require('express');
const { fetchAndStoreWrikeTasks, updateRecentWrikeTasks } = require('../controllers/wrikeTasksController');

const router = express.Router();

// 🚀 Route pour la création initiale de la table `wrike_tasks`
router.get('/createWrikeTasks', async (req, res) => {
    try {
        await fetchAndStoreWrikeTasks();
        res.status(200).json({ message: "Table `wrike_tasks` créée et remplie avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la création et du remplissage de `wrike_tasks`." });
    }
});

// 🔄 Route pour la mise à jour des tâches des 3 derniers jours
router.get('/updateWrikeTasks', async (req, res) => {
    try {
        await updateRecentWrikeTasks();
        res.status(200).json({ message: "Tâches Wrike mises à jour avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la mise à jour des tâches Wrike." });
    }
});

module.exports = router;
