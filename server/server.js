// server.js
const express = require('express');
const dotenv = require('dotenv');
const db = require('./config/db');
const delfoiRoutes = require('./routes/delfoiRoutes');
const { fetchAndStoreDelfoiData } = require('./controllers/delfoiController');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use('/api/delfoi', delfoiRoutes);

// Fonction pour exécuter la récupération des données sans chevauchement
let isFetching = false;
const executeDataFetch = async () => {
    if (isFetching) {
        console.log("⚠️ Une exécution est déjà en cours, on ignore cette exécution...");
        return;
    }

    isFetching = true;
    console.log("🔄 Exécution de fetchAndStoreDelfoiData...");
    
    try {
        await fetchAndStoreDelfoiData();
        console.log("✅ Récupération et stockage des données terminés !");
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des données :", error);
    } finally {
        isFetching = false;
    }
};

// Exécuter immédiatement fetchAndStoreDelfoiData au démarrage du serveur
console.log("🚀 Exécution initiale de fetchAndStoreDelfoiData...");
executeDataFetch();

// Exécuter fetchAndStoreDelfoiData toutes les 3 minutes
setInterval(() => {
    console.log("🕒 Planification de fetchAndStoreDelfoiData...");
    executeDataFetch();
}, 180000); // 180000 ms = 3 minutes

app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
