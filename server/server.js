// server.js
const express = require('express');
const dotenv = require('dotenv');
const db = require('./config/db');
const delfoiRoutes = require('./routes/delfoiRoutes');
const wrikeRoutes = require('./routes/wrikeRoutes');
const wrikeTasksRoutes = require('./routes/wrikeTasksRoutes');
const wrikeWorkflowsRoutes = require('./routes/wrikeWorkflowsRoutes');
const wrikeCommentsRoutes = require('./routes/wrikeCommentsRoutes');
const { fetchAndStoreDelfoiData } = require('./controllers/delfoiController');
const { syncWrikeActive } = require('./controllers/wirkControllerUpdate');
const { syncWrikeAnnuleTermineAndCleanActive } = require('./controllers/wrikeControllerUpdateAnnulesTermines');
const { fetchAndStoreWrikeTasks, updateRecentWrikeTasks } = require('./controllers/wrikeTasksController');
const { fetchAndStoreWrikeWorkflows } = require('./controllers/wrikeWorkflowsController');
const { updateRecentWrikeComments } = require('./controllers/wrikeCommentsController');
const { fetchAndStoreDelfoiSignatures } = require('./controllers/delfoiSignaturesController');



dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// ✅ États pour éviter les exécutions concurrentes
let isFetchingDelfoi = false;
let isFetchingWrikeActive = false;
let isFetchingWrikeAnnuleTermine = false;
let isFetchingWrikeTasks = false;
let isFetchingWrikeWorkflows = false;
let isFetchingWrikeComments = false;
let isFetchingDelfoiSignatures = false;
let fetchIntervalDelfoi;
let fetchIntervalWrikeActive;
let fetchIntervalWrikeAnnuleTermine;
let fetchIntervalWrikeTasks;
let fetchIntervalWrikeWorkflows;
let fetchIntervalWrikeWorkComments;
let fetchIntervalDelfoiSignatures;


// 🔄 Fonction pour exécuter `fetchAndStoreDelfoiData`
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

const executeDelfoiSignaturesFetch = async () => {
    if (isFetchingDelfoiSignatures) {
        console.log("⚠️ Une exécution de fetchAndStoreDelfoiSignatures est déjà en cours...");
        return;
    }

    isFetchingDelfoiSignatures = true;
    console.log("🔄 Exécution de fetchAndStoreDelfoiSignatures...");

    try {
        await fetchAndStoreDelfoiSignatures();
        console.log("✅ Signatures Delfoi synchronisées !");
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation des signatures :", error.message);
    } finally {
        isFetchingDelfoiSignatures = false;
    }
};

// 🔄 Fonction pour exécuter `syncWrikeActive` (Wrike Actifs)
const executeWrikeActiveFetch = async () => {
    if (isFetchingWrikeActive) {
        console.log("⚠️ Une exécution de syncWrikeActive est déjà en cours, on ignore cette exécution...");
        return;
    }

    isFetchingWrikeActive = true;
    console.log("🔄 Exécution de syncWrikeActive...");

    try {
        await syncWrikeActive();
        console.log("✅ Synchronisation des données Wrike Active terminée !");
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation des données Wrike Active :", error);
    } finally {
        isFetchingWrikeActive = false;
    }
};

// 🔄 Fonction pour exécuter `syncWrikeAnnuleTermineAndCleanActive` (Wrike Annulés & Terminés)
const executeWrikeAnnuleTermineFetch = async () => {
    if (isFetchingWrikeAnnuleTermine) {
        console.log("⚠️ Une exécution de syncWrikeAnnuleTermineAndCleanActive est déjà en cours, on ignore cette exécution...");
        return;
    }

    isFetchingWrikeAnnuleTermine = true;
    console.log("🔄 Exécution de syncWrikeAnnuleTermineAndCleanActive...");

    try {
        await syncWrikeAnnuleTermineAndCleanActive();
        console.log("✅ Synchronisation des projets annulés & terminés terminée !");
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation des projets annulés & terminés :", error);
    } finally {
        isFetchingWrikeAnnuleTermine = false;
    }
};
// 🔄 Fonction pour exécuter `fetchAndStoreWrikeTasks` (Création initiale des tâches)
const executeWrikeTasksCreation = async () => {
    if (isFetchingWrikeTasks) return console.log("⚠️ Exécution déjà en cours : fetchAndStoreWrikeTasks...");
    isFetchingWrikeTasks = true;

    try {
        console.log("🔄 Exécution de fetchAndStoreWrikeTasks...");
        await fetchAndStoreWrikeTasks();
        console.log("✅ Tâches Wrike enregistrées !");
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des tâches Wrike :", error);
    } finally {
        isFetchingWrikeTasks = false;
    }
};
// 🔄 Fonction pour exécuter `updateRecentWrikeTasks` (Mise à jour des tâches)
const executeWrikeTasksUpdate = async () => {
    if (isFetchingWrikeTasks) return console.log("⚠️ Exécution déjà en cours : updateRecentWrikeTasks...");
    isFetchingWrikeTasks = true;

    try {
        console.log("🔄 Exécution de updateRecentWrikeTasks...");
        await updateRecentWrikeTasks();
        console.log("✅ Tâches Wrike mises à jour !");
    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour des tâches Wrike :", error);
    } finally {
        isFetchingWrikeTasks = false;
    }
};

// 🔄 Fonction pour exécuter `fetchAndStoreWrikeWorkflows`
const executeWrikeWorkflowsFetch = async () => {
    if (isFetchingWrikeWorkflows) return console.log("⚠️ Exécution déjà en cours : fetchAndStoreWrikeWorkflows...");
    isFetchingWrikeWorkflows = true;

    try {
        console.log("🔄 Exécution de fetchAndStoreWrikeWorkflows...");
        await fetchAndStoreWrikeWorkflows();
        console.log("✅ Workflows Wrike enregistrés !");
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des workflows Wrike :", error);
    } finally {
        isFetchingWrikeWorkflows = false;
    }
};
// 🔄 Fonction pour exécuter `fetchAndStoreWrikeWorkflows`
const executeUpdateRecentWrikeComments = async () => {
    if (isFetchingWrikeComments) return console.log("⚠️ Exécution déjà en cours : updateRecentWrikeComments...");
    isFetchingWrikeComments = true;

    try {
        console.log("🔄 Exécution de updateRecentWrikeComments...");
        await updateRecentWrikeComments();
        console.log("✅ Comments Wrike enregistrés !");
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des Comments Wrike :", error);
    } finally {
        isFetchingWrikeComments = false;
    }
};

// 🔄 Fonction pour redémarrer les intervalles
const resetFetchIntervals = () => {
    if (fetchIntervalDelfoi) clearInterval(fetchIntervalDelfoi);
    if (fetchIntervalWrikeActive) clearInterval(fetchIntervalWrikeActive);
    if (fetchIntervalWrikeAnnuleTermine) clearInterval(fetchIntervalWrikeAnnuleTermine);
    if (fetchIntervalWrikeTasks) clearInterval(fetchIntervalWrikeTasks);
    if (fetchIntervalWrikeWorkflows) clearInterval(fetchIntervalWrikeWorkflows);
    if (fetchIntervalWrikeWorkComments) clearInterval(fetchIntervalWrikeWorkComments);
    if (fetchIntervalDelfoiSignatures) clearInterval(fetchIntervalDelfoiSignatures);

 
    console.log("🔄 Réinitialisation des intervalles de synchronisation...");

    // ⏳ Exécution toutes les 30 minutes pour Delfoi
    fetchIntervalDelfoi = setInterval(() => {
        console.log("🕒 Planification de fetchAndStoreDelfoiData...");
        executeDelfoiDataFetch();
    }, 1800000); // 30 minutes

    // ⏳ Exécution toutes les 30 minutes pour les signatures Delfoi
    fetchIntervalDelfoiSignatures = setInterval(() => {
        console.log("🕒 Planification de fetchAndStoreDelfoiSignatures...");
        executeDelfoiSignaturesFetch();
    }, 1800000); // 30 minutes

    // ⏳ Exécution toutes les 30 minutes pour Wrike Active
    fetchIntervalWrikeActive = setInterval(() => {
        console.log("🕒 Planification de syncWrikeActive...");
        executeWrikeActiveFetch();
    }, 1800000); // 30 minutes

    // ⏳ Exécution toutes les 30 minutes pour Wrike Annulés & Terminés
    fetchIntervalWrikeAnnuleTermine = setInterval(() => {
        console.log("🕒 Planification de syncWrikeAnnuleTermineAndCleanActive...");
        executeWrikeAnnuleTermineFetch();
    }, 1800000); // 30 minutes
    // ⏳ Exécution toutes les 30 minutes pour Wrike Annulés & Terminés
    fetchIntervalWrikeTasks = setInterval(() => {
        console.log("🕒 Planification de syncWrikeTasks...");
        executeWrikeTasksUpdate();
    }, 1800000); // 30 minutes
    // ⏳ Exécution toutes les 30 minutes
    fetchIntervalWrikeWorkflows = setInterval(() => {
        console.log("🕒 Planification de fetchAndStoreWrikeWorkflows...");
        executeWrikeWorkflowsFetch();
    }, 1800000); // 30 minutes
    fetchIntervalWrikeWorkComments = setInterval(() => {
        console.log("🕒 Planification de fetchIntervalWrikeWorkComments...");
        executeUpdateRecentWrikeComments();
    }, 1800000); // 30 minutes
};

// 🚀 Exécution initiale de toutes les tâches au démarrage
console.log("🚀 Exécution initiale de toutes les tâches...");
executeDelfoiDataFetch();
executeWrikeActiveFetch();
executeWrikeAnnuleTermineFetch();
executeWrikeTasksUpdate();
executeWrikeWorkflowsFetch();
executeUpdateRecentWrikeComments();
executeDelfoiSignaturesFetch();
// 🔄 Lancer le cycle automatique
resetFetchIntervals();

app.use('/api/delfoi', delfoiRoutes);
app.use('/api/wrike', wrikeRoutes);
app.use('/api/wrikeTasks', wrikeTasksRoutes);
app.use('/api/workflows', wrikeWorkflowsRoutes);
app.use('/api/wrikeComments', wrikeCommentsRoutes);

app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
