// routes/sharepointRoutesTbl_Loc.js
const express = require('express');
const { 
    syncSharePointLocData, 
    syncGeniusLocData, 
    replaceSharePointWithGeniusLoc 
} = require('../controllers/sharepointControllerTbl_InvItemsLocOri_ID');
const notifyByEmail = require('../utils/sendErrorEmail');

const router = express.Router();

router.get('/sync-genius-Tbl-Loc', async (req, res) => {
    try {
        await syncGeniusLocData();
        res.status(200).json({ message: '✅ Synchronisation Genius Tbl_Loc réussie !' });
    } catch (error) {
        await notifyByEmail('❌ Erreur lors de la synchronisation Genius Tbl_Loc', error.message);
        res.status(500).json({ error: '❌ Échec de la synchronisation Genius Tbl_Loc.' });
    }
});

router.get('/sync-sharepoint-Tbl-Loc', async (req, res) => {
    try {
        await syncSharePointLocData();
        res.status(200).json({ message: '✅ Synchronisation SharePoint Tbl_Loc réussie !' });
    } catch (error) {
        await notifyByEmail('❌ Erreur lors de la synchronisation SharePoint Tbl_Loc', error.message);
        res.status(500).json({ error: '❌ Échec de la synchronisation SharePoint Tbl_Loc.' });
    }
});

router.get('/replace-with-genius-Tbl-Loc', async (req, res) => {
    try {
        const result = await replaceSharePointWithGeniusLoc();
        res.status(200).json({
            message: result.message,
            deletionDuration: result.deletionDuration,
            insertionDuration: result.insertionDuration
        });
    } catch (error) {
        await notifyByEmail('❌ Erreur lors du remplacement SharePoint par Genius (Tbl_Loc)', error.message);
        res.status(500).json({ error: '❌ Échec du remplacement SharePoint par Genius Tbl_Loc.' });
    }
});

module.exports = router;