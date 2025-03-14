const axios = require('axios');
const db = require('../config/db');

const WRIKE_API_TOKEN = process.env.WRIKE_API_TOKEN;
const WRIKE_SPACE_ID = process.env.WRIKE_SPACE_ID;

const headers = {
    Authorization: `Bearer ${WRIKE_API_TOKEN}`,
    'Content-Type': 'application/json'
};

// 🔹 Fonction pour convertir une date ISO 8601 en DATETIME MySQL
const formatDateForMySQL = (isoDate) => {
    if (!isoDate) return null;
    return isoDate.replace("T", " ").replace("Z", ""); // Convertit en 'YYYY-MM-DD HH:MM:SS'
};

// 🔹 Fonction pour obtenir une date correcte pour Wrike
const getFormattedDate = (daysAgo) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString().split('.')[0] + "Z"; // Format: YYYY-MM-DDTHH:mm:ssZ
};

const fetchAndStoreWrikeData = async () => {
    try {
        console.log("🔄 Début de la récupération des données Wrike...");

        // 🔹 Format correct de la date pour Wrike
        const updatedDate = getFormattedDate(3);

        let nextPageToken = null;
        let totalRecords = 0;

        do {
            // 🔹 Construire l'URL avec ou sans `nextPageToken`
            let url = `https://www.wrike.com/api/v4/spaces/${WRIKE_SPACE_ID}/folders?fields=["customFields"]&updatedDate={"start":"${updatedDate}"}`;
            if (nextPageToken) {
                url += `&nextPageToken=${nextPageToken}`;
            }

            // 🔹 Récupération des données
            const [response, customFieldsResponse] = await Promise.all([
                axios.get(url, { headers }),
                axios.get("https://www.wrike.com/api/v4/customfields", { headers })
            ]);

            if (!response.data.data || !Array.isArray(response.data.data)) {
                console.warn("⚠️ Aucune donnée reçue de Wrike.");
                return;
            }

            // 🔹 Mapping des Custom Fields (ID -> Nom)
            const customFieldMap = {};
            for (const field of customFieldsResponse.data.data) {
                customFieldMap[field.id] = field.title;
            }

            for (const project of response.data.data) {
                const customFields = {};

                for (const cf of project.customFields || []) {
                    const fieldName = customFieldMap[cf.id] || `custom_${cf.id}`;
                    customFields[fieldName] = cf.value || null;
                }

                await db.execute(
                    `INSERT INTO wrike_projects (
                        id, permalink, account_id, title, created_date, updated_date, 
                        workflow_id, fm_link, custom_fields
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    permalink = VALUES(permalink),
                    account_id = VALUES(account_id),
                    title = VALUES(title),
                    created_date = VALUES(created_date),
                    updated_date = VALUES(updated_date),
                    workflow_id = VALUES(workflow_id),
                    fm_link = VALUES(fm_link),
                    custom_fields = VALUES(custom_fields)`,
                    [
                        project.id,
                        project.permalink,
                        project.accountId,
                        project.title,
                        formatDateForMySQL(project.createdDate), // 🔹 Correction format MySQL
                        formatDateForMySQL(project.updatedDate), // 🔹 Correction format MySQL
                        project.workflowId,
                        project.title.startsWith("MP-") ? project.title.substring(0, 10) : "",
                        JSON.stringify(customFields)
                    ]
                );
                totalRecords++;
            }

            console.log(`📦 Enregistrés : ${totalRecords} projets Wrike.`);

            // Vérifier s'il y a encore des données à récupérer
            nextPageToken = response.data.nextPageToken || null;

            // 🔹 Protection contre l'erreur 429 (Trop de requêtes)
            if (nextPageToken) {
                console.log("⏳ Pause 2 secondes pour éviter l'erreur 429...");
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

        } while (nextPageToken); // 🔄 Continuer tant qu'il y a une page suivante

        console.log("✅ Données Wrike récupérées et stockées !");
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des données Wrike :", error.response?.data || error.message);
    }
};

module.exports = { fetchAndStoreWrikeData };
