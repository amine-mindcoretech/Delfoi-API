const express = require('express');
const { fetchAndStoreAllWrikeComments, updateRecentWrikeComments } = require('../controllers/wrikeCommentsController');

const router = express.Router();

// 🚀 Route pour récupérer **tous** les commentaires Wrike (chargement initial)
router.get('/fetchAllWrikeComments', async (req, res) => {
    try {
        await fetchAndStoreAllWrikeComments();
        res.status(200).json({ message: "Tous les commentaires Wrike enregistrés avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération des commentaires Wrike." });
    }
});

// 🔄 Route pour mettre à jour **les commentaires des 3 derniers jours**
router.get('/updateWrikeComments', async (req, res) => {
    try {
        await updateRecentWrikeComments();
        res.status(200).json({ message: "Mise à jour des commentaires Wrike effectuée avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la mise à jour des commentaires Wrike." });
    }
});

module.exports = router;
