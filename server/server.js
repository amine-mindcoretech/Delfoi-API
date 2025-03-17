// server.js
const express = require('express');
const dotenv = require('dotenv');
const db = require('./config/db');
const delfoiRoutes = require('./routes/delfoiRoutes');
const wrikeRoutes = require('./routes/wrikeRoutes');
const { fetchAndStoreDelfoiData } = require('./controllers/delfoiController');
const { syncWrikeData } = require('./controllers/wirkControllerUpdate'); // Import de syncWrikeData

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// ✅ Fonction pour exécuter la récupération des données sans chevauchement
let isFetchingDelfoi = false;
let isFetchingWrike = false;
let fetchIntervalDelfoi;
let fetchIntervalWrike;

// 🔄 Fonction pour exécuter fetchAndStoreDelfoiData
const executeDelfoiDataFetch = async () => {
    if (isFetchingDelfoi) {
        console.log("⚠️ Une exécution de fetchAndStoreDelfoiData est déjà en cours, on ignore cette exécution...");
        return;
    }

    isFetchingDelfoi = true;
    console.log("🔄 Exécution de fetchAndStoreDelfoiData...");

    try {
        await fetchAndStoreDelfoiData();
        console.log("✅ Récupération et stockage des données Delfoi terminés !");
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des données Delfoi :", error);
    } finally {
        isFetchingDelfoi = false;
    }
};

// 🔄 Fonction pour exécuter syncWrikeData
const executeWrikeDataFetch = async () => {
    if (isFetchingWrike) {
        console.log("⚠️ Une exécution de syncWrikeData est déjà en cours, on ignore cette exécution...");
        return;
    }

    isFetchingWrike = true;
    console.log("🔄 Exécution de syncWrikeData...");

    try {
        await syncWrikeData();
        console.log("✅ Synchronisation des données Wrike terminée !");
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation des données Wrike :", error);
    } finally {
        isFetchingWrike = false;
    }
};

// 🔄 Planification de l'exécution automatique
const startFetchIntervals = () => {
    if (fetchIntervalDelfoi) clearInterval(fetchIntervalDelfoi);
    if (fetchIntervalWrike) clearInterval(fetchIntervalWrike);

    // ⏳ Exécution toutes les 3 minutes pour Delfoi
    fetchIntervalDelfoi = setInterval(() => {
        console.log("🕒 Planification de fetchAndStoreDelfoiData...");
        executeDelfoiDataFetch();
    }, 180000); // 180000 ms = 3 minutes

    // ⏳ Exécution toutes les 30 minutes pour Wrike
    fetchIntervalWrike = setInterval(() => {
        console.log("🕒 Planification de syncWrikeData...");
        executeWrikeDataFetch();
    }, 1800000); // 1800000 ms = 30 minutes
};

// 🚀 Exécution initiale des deux récupérations au démarrage
console.log("🚀 Exécution initiale de fetchAndStoreDelfoiData et syncWrikeData...");
executeDelfoiDataFetch();
executeWrikeDataFetch();

// 🔄 Lancer le cycle automatique
startFetchIntervals();

app.use('/api/delfoi', delfoiRoutes);
app.use('/WrikeProjects', wrikeRoutes);

app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
