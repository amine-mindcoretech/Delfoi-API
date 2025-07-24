//wrikeTasksRoutes.js
const express = require('express');
const { fetchAndStoreWrikeTasks, updateRecentWrikeTasks } = require('../controllers/wrikeTasksController');
const notifyByEmail = require('../utils/sendErrorEmail');

const router = express.Router();

// 🚀 Route pour la création initiale de la table `wrike_tasks`
router.get('/CreateWrikeTasks', async (req, res) => {
    try {
        await fetchAndStoreWrikeTasks();
        res.status(200).json({ message: "Table `wrike_tasks` créée et remplie avec succès." });
    } catch (error) {
        await notifyByEmail(
            '❌ Erreur - createWrikeTasks',
            `Une erreur est survenue dans /createWrikeTasks : ${error.message}`
        );
        res.status(500).json({ error: "❌ Erreur lors de la création et du remplissage de `wrike_tasks`." });
    }
});

// 🔄 Route pour la mise à jour des tâches des 3 derniers jours
router.get('/FetchWrikeTasks', async (req, res) => {
    try {
        await updateRecentWrikeTasks();
        res.status(200).json({ message: "Tâches Wrike mises à jour avec succès." });
    } catch (error) {
        await notifyByEmail(
            '❌ Erreur - updateWrikeTasks',
            `Une erreur est survenue dans /FetchWrikeTasks : ${error.message}`
        );
        res.status(500).json({ error: "❌ Erreur lors de la mise à jour des tâches Wrike." });
    }
});

module.exports = router;
