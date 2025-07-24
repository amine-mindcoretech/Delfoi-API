//wirkControllerUpdate.js
const axios = require('axios');
const db = require('../config/db');

const WRIKE_API_TOKEN = process.env.WRIKE_API_TOKEN;
const WRIKE_SPACE_ID = process.env.WRIKE_SPACE_ID;

const headers = {
    Authorization: `Bearer ${WRIKE_API_TOKEN}`,
    'Content-Type': 'application/json'
};

// 🔹 Fonction pour formater une date ISO en DATETIME MySQL
const formatDateForMySQL = (isoDate) => {
    if (!isoDate || isoDate.trim() === "") return null;
    return isoDate.replace("T", " ").replace("Z", "");
};

// 🔹 Fonction pour formater les noms de colonnes pour la base de données
const formatColumnName = (title) => {
    return 'custom_' + title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_') 
        .replace(/_+$/, ''); 
};

// 🔹 Fonction pour convertir les types Wrike en types SQL
const mapWrikeTypeToSQL = (wrikeType) => {
    switch (wrikeType) {
        case 'Numeric':
        case 'Percentage':
        case 'Currency':
            return 'DECIMAL(15,2)';
        case 'Date':
            return 'DATETIME';
        case 'Checkbox':
            return 'BOOLEAN';
        case 'DropDown':
        case 'Text':
        default:
            return 'TEXT';
    }
};

// 🔹 Fonction pour récupérer les custom fields et ajouter les colonnes manquantes
const ensureCustomFieldsExist = async () => {
    try {
        console.log("🔍 Vérification des nouveaux champs personnalisés...");

        const response = await axios.get("https://www.wrike.com/api/v4/customfields", { headers });
        const data = response.data;
        if (!data || !data.data) {
            console.warn("⚠️ Aucun champ personnalisé récupéré.");
            return {};
        }

        const [rows] = await db.execute("SHOW COLUMNS FROM wrike_projects_active");
        const existingColumns = rows.map(row => row.Field);

        const customFieldMap = {};
        const customFieldTypes = {};

        for (const field of data.data) {
            const columnName = formatColumnName(field.title);
            if (!existingColumns.includes(columnName)) {
                const columnType = mapWrikeTypeToSQL(field.type);
                await db.execute(`ALTER TABLE wrike_projects_active ADD COLUMN ${columnName} ${columnType}`);
                console.log(`✅ Nouveau champ ajouté : ${columnName} (${columnType})`);
            }
            customFieldMap[field.id] = columnName;
            customFieldTypes[columnName] = mapWrikeTypeToSQL(field.type);
        }

        return { customFieldMap, customFieldTypes };
    } catch (error) {
        console.error("❌ Erreur lors de la vérification des nouveaux champs personnalisés :", error.message);
        return { customFieldMap: {}, customFieldTypes: {} };
    }
};

// 🔹 Fonction pour extraire `FM_NoCom` depuis `Title`
const extractFMNoCom = (title) => {
    const match = title.match(/^MP-(\d+)-/);
    return match ? match[1].padStart(8, '0') : null;
};
const extractFMLink = (title) => {
    const match = title.match(/^(MP-\d+-\d+)/);
    return match ? match[1] : null;
};

// 🔹 Fonction pour obtenir la date des 3 derniers jours pour Wrike
const getThreeDaysAgoDate = () => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 3);
    return date.toISOString().split('.')[0] + "Z"; 
};

// 🔹 Fonction pour récupérer et mettre à jour les projets mis à jour dans les 3 derniers jours
const updateRecentProjects = async () => {
    try {
        console.log("🔄 Récupération des projets mis à jour ces 3 derniers jours...");

        const updatedDate = getThreeDaysAgoDate();
        const url = `https://www.wrike.com/api/v4/spaces/${WRIKE_SPACE_ID}/folders?fields=["customFields"]&updatedDate={"start":"${updatedDate}"}`;

        const response = await axios.get(url, { headers });
        const data = response.data;
        if (!data || !data.data) {
            console.warn("⚠️ Aucun projet mis à jour trouvé.");
            return;
        }

        let updatedCount = 0;

        // Récupérer les custom fields existants en DB et ceux à jour dans Wrike
        const { customFieldMap, customFieldTypes } = await ensureCustomFieldsExist();

        for (const project of data.data) {
            if (!project.title.startsWith("MP-")) continue; // Filtrer uniquement les projets "MP-"

            const fmNoCom = extractFMNoCom(project.title);
            const fmLink = extractFMLink(project.title);
            const customFieldValues = {};
            for (const cf of project.customFields || []) {
                if (customFieldMap[cf.id]) {
                    let value = cf.value !== undefined ? cf.value : null;

                    if (customFieldTypes[customFieldMap[cf.id]] === 'DATETIME') {
                        value = formatDateForMySQL(value);
                    }

                    if (customFieldTypes[customFieldMap[cf.id]] === 'DECIMAL(15,2)') {
                        value = (value === "" || value === null) ? null : parseFloat(value);
                    }

                    customFieldValues[customFieldMap[cf.id]] = value;
                }
            }

            const fields = ["ID", "Permalink", "AccountId", "Title", "FM_NoCom", "FM_LINK", "CreatedDate", "UpdatedDate", "WorkflowId", ...Object.keys(customFieldValues)];
            const updateFields = fields.map(col => `${col} = ?`).join(", ");
            const values = [project.id, project.permalink, project.accountId, project.title,fmNoCom, fmLink, formatDateForMySQL(project.createdDate), formatDateForMySQL(project.updatedDate), project.workflowId, ...Object.values(customFieldValues), project.id];

            await db.execute(`
                UPDATE wrike_projects_active 
                SET ${updateFields}
                WHERE id = ?
            `, values);

            updatedCount++;
        }

        console.log(`✅ ${updatedCount} projets mis à jour dans wrike_projects_active.`);
    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour des projets récents :", error.message);
    }
};

// 🔹 Fonction principale pour synchroniser les données Wrike
const syncWrikeData = async () => {
    try {
        console.log("🚀 Lancement de la synchronisation des données Wrike...");

        // 1️⃣ Vérifier et ajouter les nouveaux champs personnalisés
        await ensureCustomFieldsExist();

        // 2️⃣ Mettre à jour les projets des 3 derniers jours
        await updateRecentProjects();

        console.log("✅ Synchronisation terminée !");
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation :", error.message);
    }
};

module.exports = { syncWrikeData };
