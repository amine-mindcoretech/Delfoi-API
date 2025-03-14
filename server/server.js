// server.js
const express = require('express');
const dotenv = require('dotenv');
const db = require('./config/db');
const delfoiRoutes = require('./routes/delfoiRoutes');
const wrikeRoutes = require('./routes/wrikeRoutes');
const { fetchAndStoreDelfoiData } = require('./controllers/delfoiController');
const { fetchAndStoreWrikeData } = require('./controllers/wrikeController');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use('/api/delfoi', delfoiRoutes);
app.use('/api/wrike', wrikeRoutes);

// Fonction pour exécuter la récupération des données sans chevauchement
let isFetching = false;
let fetchInterval;

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


// Fonction pour programmer la récupération toutes les 3 minutes
const startFetchInterval = () => {
    if (fetchInterval) clearInterval(fetchInterval);
    fetchInterval = setInterval(() => {
        console.log("🕒 Planification de fetchAndStoreDelfoiData...");
        executeDataFetch();
    }, 180000); // 180000 ms = 3 minutes
};

// Exécuter immédiatement la récupération des données au démarrage
console.log("🚀 Exécution initiale de fetchAndStoreDelfoiData...");
executeDataFetch();

// Lancer le cycle toutes les 3 minutes
startFetchInterval();



let isFetchingWrike = false;
let fetchWrikeInterval;

// Fonction d'exécution Wrike
const executeWrikeFetch = async () => {
    if (isFetchingWrike) {
        console.log("⚠️ Wrike est déjà en cours d'exécution...");
        return;
    }

    isFetchingWrike = true;
    console.log("🔄 Exécution de fetchAndStoreWrikeData...");
    
    try {
        await fetchAndStoreWrikeData();
        console.log("✅ Données Wrike mises à jour !");
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des données Wrike :", error);
    } finally {
        isFetchingWrike = false;
    }
};

// Démarrage initial
console.log("🚀 Initialisation de la récupération Wrike...");
executeWrikeFetch();

// Exécuter fetchAndStoreWrikeData tous les 3 jours
const startWrikeInterval = () => {
    if (fetchWrikeInterval) clearInterval(fetchWrikeInterval);
    fetchWrikeInterval = setInterval(() => {
        console.log("🕒 Planification de fetchAndStoreWrikeData...");
        executeWrikeFetch();
    }, 3 * 24 * 60 * 60 * 1000); // 3 jours = 3 * 24 heures * 60 minutes * 60 secondes * 1000 millisecondes
};

startWrikeInterval();


app.use('/api/delfoi', delfoiRoutes);
app.use('/WrikeProjects', wrikeRoutes);


app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
