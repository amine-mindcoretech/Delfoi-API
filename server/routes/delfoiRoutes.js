// routes/delfoiRoutes.js
const express = require('express');
const { fetchAndStoreDelfoiData } = require('../controllers/delfoiController');
const router = express.Router();

router.get('/fetch', fetchAndStoreDelfoiData);

module.exports = router;

