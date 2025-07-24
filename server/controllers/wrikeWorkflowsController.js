//wrikeWorkflowsController.js
const axios = require('axios');
const db = require('../config/db');

const WRIKE_API_TOKEN = process.env.WRIKE_API_TOKEN;
const HEADERS = {
    Authorization: `Bearer ${WRIKE_API_TOKEN}`,
    'Content-Type': 'application/json'
};

// 🔹 Création des tables `wrike_workflows` et `wrike_workflow_statuses`
const createWrikeWorkflowsTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS wrike_workflows (
                Id VARCHAR(50) PRIMARY KEY,
                Name TEXT,
                Standard BOOLEAN,
                Hidden BOOLEAN
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS wrike_workflow_statuses (
                Id VARCHAR(50) PRIMARY KEY,
                WorkflowId VARCHAR(50),
                Name TEXT,
                Color VARCHAR(50),
                StatusGroup VARCHAR(50),
                Standard BOOLEAN,
                Hidden BOOLEAN,
                StandardName BOOLEAN,
                FOREIGN KEY (WorkflowId) REFERENCES wrike_workflows(Id) ON DELETE CASCADE
            )
        `);
        console.log("✅ Tables `wrike_workflows` et `wrike_workflow_statuses` vérifiées/créées.");
    } catch (error) {
        console.error("❌ Erreur lors de la création des tables :", error.message);
    }
};

// 🔹 Fonction pour récupérer et stocker les workflows Wrike
const fetchAndStoreWrikeWorkflows = async () => {
    try {
        console.log("🚀 Démarrage de la récupération des workflows Wrike...");

        // Création des tables si elles n'existent pas
        await createWrikeWorkflowsTable();

        // 📌 L'API Wrike Workflows ne supporte pas `pageSize` ni `nextPageToken`
        const url = "https://www.wrike.com/api/v4/workflows";

        // 🛠️ Appel de l'API Wrike
        const response = await axios.get(url, { headers: HEADERS });

        // Vérification de la réponse API
        if (!response.data || !response.data.data) {
            throw new Error("Réponse invalide de l'API Wrike.");
        }

        const workflows = response.data.data;
        console.log(`📥 ${workflows.length} workflows récupérés.`);

        // 💾 Enregistrement des workflows en base de données
        for (const workflow of workflows) {
            await insertOrUpdateWorkflow(workflow);
        }

        console.log(`✅ Récupération terminée : ${workflows.length} workflows Wrike enregistrés.`);

    } catch (error) {
        console.error("❌ Erreur lors de la récupération des workflows Wrike :", error.message);

        // 📌 Vérifier si Wrike a retourné plus d'informations sur l'erreur
        if (error.response && error.response.data) {
            console.error("🔍 Détails de l'erreur Wrike :", JSON.stringify(error.response.data, null, 2));
        }
    }
};

// 🔹 Fonction pour insérer ou mettre à jour un workflow et ses statuts associés
const insertOrUpdateWorkflow = async (workflow) => {
    try {
        const { id, name, standard, hidden, customStatuses } = workflow;

        // Insertion / Mise à jour du workflow
        await db.execute(`
            INSERT INTO wrike_workflows (Id, Name, Standard, Hidden)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            Name = VALUES(Name), 
            Standard = VALUES(Standard), 
            Hidden = VALUES(Hidden)
        `, [id, name, standard ? 1 : 0, hidden ? 1 : 0]);

        // Insertion / Mise à jour des statuts associés
        for (const status of customStatuses) {
            await db.execute(`
                INSERT INTO wrike_workflow_statuses (Id, WorkflowId, Name, Color, StatusGroup, Standard, Hidden, StandardName)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                Name = VALUES(Name), 
                Color = VALUES(Color), 
                StatusGroup = VALUES(StatusGroup),
                Standard = VALUES(Standard),
                Hidden = VALUES(Hidden),
                StandardName = VALUES(StandardName)
            `, [
                status.id,
                id,
                status.name,
                status.color,
                status.group, // ✅ Colonne renommée en "StatusGroup"
                status.standard ? 1 : 0,
                status.hidden ? 1 : 0,
                status.standardName ? 1 : 0
            ]);
        }

    } catch (error) {
        console.error(`❌ Erreur lors de l'insertion/mise à jour du workflow ${workflow.id} :`, error.message);
    }
};

module.exports = { fetchAndStoreWrikeWorkflows, createWrikeWorkflowsTable };
