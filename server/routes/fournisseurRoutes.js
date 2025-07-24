const express = require('express');
const router = express.Router();
const fournisseurController = require('../controllers/fournisseurController');

router.post('/create', fournisseurController.createTable);
router.post('/sync', fournisseurController.syncData);
router.get('/download-csv', fournisseurController.downloadCSV);
router.delete('/drop', fournisseurController.dropTable);

module.exports = router;