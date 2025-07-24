


/////////////////////////
// server.js
const express = require('express');
const dotenv = require('dotenv');
const db = require('./config/db');
const delfoiRoutes = require('./routes/delfoiRoutes');
const wrikeRoutes = require('./routes/wrikeRoutes');
const wrikeTasksRoutes = require('./routes/wrikeTasksRoutes');
const wrikeWorkflowsRoutes = require('./routes/wrikeWorkflowsRoutes');
const wrikeCommentsRoutes = require('./routes/wrikeCommentsRoutes');
const sharepointRoutes = require('./routes/sharepointRoutes');
const sharepointRoutesTbl_InvItemsLocOri_ID = require('./routes/sharepointRoutesTbl_InvItemsLocOri_ID');
const sharepointRoutesTbl_Loc = require('./routes/sharepointRoutesTbl_Loc'); // Add new route file
const notifyByEmail = require('./utils/sendErrorEmail');
const { fetchAndStoreDelfoiData } = require('./controllers/delfoiController');
const { syncWrikeData } = require('./controllers/wirkControllerUpdate'); // Import de syncWrikeData
const { syncWrikeAnnuleTermineAndCleanActive } = require('./controllers/wrikeControllerUpdateAnnulesTermines');
const { fetchAndStoreWrikeTasks, updateRecentWrikeTasks } = require('./controllers/wrikeTasksController');
const { fetchAndStoreWrikeWorkflows } = require('./controllers/wrikeWorkflowsController');
const { updateRecentWrikeComments } = require('./controllers/wrikeCommentsController');
const { fetchAndStoreDelfoiSignatures } = require('./controllers/delfoiSignaturesController');
const { fetchRecentUpdatedItems } = require('./controllers/sharepointController');
const fournisseurRoutes = require('./routes/fournisseurRoutes');
const cors = require('cors');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

// ✅ Fonction pour exécuter la récupération des données sans chevauchement
let isFetchingDelfoi = false;
let isFetchingWrikeActive = false;
let isFetchingWrikeAnnuleTermine = false;
let isFetchingWrikeTasks = false;
let isFetchingWrikeWorkflows = false;
let isFetchingWrikeComments = false;
let isFetchingDelfoiSignatures = false;
let isFetchingSharepoint = false;
let fetchIntervalDelfoi;
let fetchIntervalWrikeActive;
let fetchIntervalWrikeAnnuleTermine;
let fetchIntervalWrikeTasks;
let fetchIntervalWrikeWorkflows;
let fetchIntervalWrikeWorkComments;
let fetchIntervalDelfoiSignatures;
let fetchIntervalSharepoint;

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
        await notifyByEmail("❌ Erreur lors de la récupération des données Delfoi", error.message);
    } finally {
        isFetchingDelfoi = false;
    }
};

// 🔄 Fonction pour exécuter syncWrikeActive
const executeWrikeActiveFetch = async () => {
    if (isFetchingWrikeActive) {
        console.log("⚠️ Une exécution de syncWrikeActive est déjà en cours, on ignore cette exécution...");
        return;
    }

    isFetchingWrikeActive = true;
    console.log("🔄 Exécution de syncWrikeActive...");

    try {
        await syncWrikeData();
        console.log("✅ Synchronisation des données WrikeActive terminée!");
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation des données WrikeActive:", error);
        await notifyByEmail("❌ Erreur lors de la synchronisation des données Wrike Active", error.message);
    } finally {
        isFetchingWrike = false;
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
        await notifyByEmail("❌ Erreur lors de la synchronisation des signatures", error.message);
    } finally {
        isFetchingDelfoiSignatures = false;
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
        await notifyByEmail("❌ Erreur lors de la synchronisation des projets annulés & terminés", error.message);
    } finally {
        isFetchingWrikeAnnuleTermine = false;
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
        await notifyByEmail("❌ Erreur lors de la mise à jour des tâches Wrike", error.message);
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
        await notifyByEmail("❌ Erreur lors de la récupération des workflows Wrike", error.message);
    } finally {
        isFetchingWrikeWorkflows = false;
    }
};
// 🔄 Fonction pour exécuter `fetchAndStoreWrikeComments`
const executeUpdateRecentWrikeComments = async () => {
    if (isFetchingWrikeComments) return console.log("⚠️ Exécution déjà en cours : updateRecentWrikeComments...");
    isFetchingWrikeComments = true;

    try {
        console.log("🔄 Exécution de updateRecentWrikeComments...");
        await updateRecentWrikeComments();
        console.log("✅ Comments Wrike enregistrés !");
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des Comments Wrike :", error);
        await notifyByEmail("❌ Erreur lors de la récupération des Comments Wrike", error.message);
    } finally {
        isFetchingWrikeComments = false;
    }
};

//🔄 Fonction pour exécuter la sychnorinastion de l'inventaire dans Sharepoint
const executeSharepointFetch = async () => {
    if (isFetchingSharepoint) {
        console.log("⚠️ Une exécution SharePoint est déjà en cours...");
        return;
    }

    isFetchingSharepoint = true;
    console.log("🔄 Exécution de fetchRecentUpdatedItems...");

    try {
        await fetchRecentUpdatedItems();
        console.log("✅ Données SharePoint mises à jour !");
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation SharePoint :", error.message);
        await notifyByEmail("❌ Erreur lors de la synchronisation SharePoint", error.message);
    } finally {
        isFetchingSharepoint = false;
    }
};

// 🔄 Planification de l'exécution automatique
const startFetchIntervals = () => {
    if (fetchIntervalDelfoi) clearInterval(fetchIntervalDelfoi);
    if (fetchIntervalWrikeActive) clearInterval(fetchIntervalWrikeActive);
    if (fetchIntervalWrikeAnnuleTermine) clearInterval(fetchIntervalWrikeAnnuleTermine);
    if (fetchIntervalWrikeTasks) clearInterval(fetchIntervalWrikeTasks);
    if (fetchIntervalWrikeWorkflows) clearInterval(fetchIntervalWrikeWorkflows);
    if (fetchIntervalWrikeWorkComments) clearInterval(fetchIntervalWrikeWorkComments);
    if (fetchIntervalDelfoiSignatures) clearInterval(fetchIntervalDelfoiSignatures);
    if (fetchIntervalSharepoint) clearInterval(fetchIntervalSharepoint);
    console.log("🔄 Réinitialisation des intervalles de synchronisation...");
    // ⏳ Exécution toutes les 3 minutes pour Delfoi
    fetchIntervalDelfoi = setInterval(() => {
        console.log("🕒 Planification de fetchAndStoreDelfoiData...");
        executeDelfoiDataFetch();
    }, 180000); // 180000 ms = 3 minutes

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
    fetchIntervalSharepoint = setInterval(() => {
        console.log("🕒 Planification de fetch inventaire sharepoint...");
        executeSharepointFetch();
    }, 2400000); // 40 minutes = 2.4M ms
};

// 🚀 Exécution initiale des deux récupérations au démarrage
console.log("🚀 Exécution initiale de fetchAndStoreDelfoiData et syncWrikeData...");
executeDelfoiDataFetch();
executeWrikeActiveFetch();
executeWrikeAnnuleTermineFetch();
executeWrikeTasksUpdate();
executeWrikeWorkflowsFetch();
executeUpdateRecentWrikeComments();
executeDelfoiSignaturesFetch();
// executeSharepointFetch();
// 🔄 Lancer le cycle automatique
startFetchIntervals();

app.use('/DelfoiOperations', delfoiRoutes);
app.use('/WrikeProjects', wrikeRoutes);
app.use('/WrikeTasks', wrikeTasksRoutes);
app.use('/Workflows', wrikeWorkflowsRoutes);
app.use('/WrikeComments', wrikeCommentsRoutes);
app.use('/Sharepoint', sharepointRoutes);
app.use('/api/fournisseur', fournisseurRoutes);
app.use('/api/sharepoint-tbl-invitems-locori', sharepointRoutesTbl_InvItemsLocOri_ID);
app.use('/api/sharepoint-tbl-loc', sharepointRoutesTbl_Loc); // Add new route prefix

app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur le port ${PORT}`);
});