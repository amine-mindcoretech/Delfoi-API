// controllers/wrikeController.js
const axios = require('axios');
const db = require('../config/db');

const WRIKE_API_TOKEN = process.env.WRIKE_API_TOKEN;
const WRIKE_SPACE_ID = process.env.WRIKE_SPACE_ID;

const headers = {
    Authorization: `Bearer ${WRIKE_API_TOKEN}`,
    'Content-Type': 'application/json'
};

// 🔹 Fonction pour attendre un certain temps (délai entre les requêtes)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🔹 Fonction qui gère les appels API avec retry en cas d’erreur 429 (Rate Limit Exceeded)
const fetchWithRetry = async (url, maxRetries = 5, delay = 100) => {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await axios.get(url, { headers });
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                attempt++;
                const waitTime = delay * (2 ** attempt); // Exponential backoff (2^attempt)
                console.warn(`⚠️ API rate limit atteint (429). Tentative ${attempt}/${maxRetries}. Réessai dans ${waitTime / 1000} sec...`);
                await sleep(waitTime);
            } else {
                throw error; // Propage les autres erreurs
            }
        }
    }

    throw new Error(`❌ Échec après ${maxRetries} tentatives (Erreur 429)`);
};

// 🔹 Fonction pour formater les noms de colonnes
const formatColumnName = (title) => {
    return 'custom_' + title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_') // Remplace les caractères spéciaux par '_'
        .replace(/_+$/, ''); // Supprime les underscores à la fin
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

// 🔹 Fonction pour formater une date ISO en DATETIME MySQL
const formatDateForMySQL = (isoDate) => {
    if (!isoDate || isoDate.trim() === "") return null;
    return isoDate.replace("T", " ").replace("Z", "");
};

// 🔹 Extraire FM_LINK : tout ce qui commence par [MP- et finit soit par ] soit par un espace ou fin de ligne
const extractFMLink = (title) => {
    const match = title.match(/\[(MP-[^\]\s]+)/i) || title.match(/(MP-[^\]\s]+)/i);
    return match ? match[1].trim() : null;
};


// 🔹 Extraire FM_NoCom : basé sur ce qui suit MP- (alphanumérique, avant un tiret si présent)
const extractFMNoCom = (title) => {
    const match = title.match(/MP-([A-Z#0-9]+)/i);
    if (!match) return null;

    const baseCode = match[1].split('-')[0].toUpperCase();
    return `0000${baseCode}`;
};
// 🔹 Création de la table si elle n'existe pas
const createTableIfNotExists = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS wrike_projects_active (
                ID VARCHAR(50) PRIMARY KEY,
                Permalink TEXT,
                AccountId VARCHAR(50),
                Title TEXT,
                FM_NoCom VARCHAR(50),
                FM_LINK VARCHAR(100),
                CreatedDate DATETIME,
                UpdatedDate DATETIME,
                WorkflowId VARCHAR(100)
            )
        `);
        console.log("✅ Table `wrike_projects_active` vérifiée/créée.");
    } catch (error) {
        console.error("❌ Erreur lors de la création de la table :", error.message);
    }
};

// 🔹 Récupérer la liste des Custom Fields de Wrike
const fetchCustomFieldsMapping = async () => {
    try {
        console.log("🔄 Récupération des Custom Fields...");
        const data = await fetchWithRetry("https://www.wrike.com/api/v4/customfields");

        if (!data || !data.data) {
            console.warn("⚠️ Aucun champ personnalisé récupéré.");
            return {};
        }

        const customFieldMap = {};
        const customFieldTypes = {};

        data.data.forEach(field => {
            if (field.id && field.title) {
                const columnName = formatColumnName(field.title);
                customFieldMap[field.id] = columnName;
                customFieldTypes[columnName] = mapWrikeTypeToSQL(field.type);
            }
        });

        console.log("✅ Custom Fields map :", customFieldMap);
        return { customFieldMap, customFieldTypes };
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des Custom Fields :", error.message);
        return { customFieldMap: {}, customFieldTypes: {} };
    }
};

// 🔹 Vérifier et ajouter les nouvelles colonnes pour les champs personnalisés
const ensureColumnsExist = async (customFieldTypes) => {
    try {
        const [rows] = await db.execute("SHOW COLUMNS FROM wrike_projects_active");
        const existingColumns = rows.map(row => row.Field);

        for (const [columnName, columnType] of Object.entries(customFieldTypes)) {
            if (!existingColumns.includes(columnName)) {
                await db.execute(`ALTER TABLE wrike_projects_active ADD COLUMN ${columnName} ${columnType}`);
                console.log(`✅ Nouvelle colonne ajoutée : ${columnName} (${columnType})`);
            }
        }
    } catch (error) {
        console.error("❌ Erreur lors de la vérification/ajout des colonnes :", error.message);
    }
};

// 🔹 Récupérer tous les dossiers d'un espace
const fetchFoldersFromSpace = async () => {
    try {
        console.log(`🔄 Récupération des folders pour l'espace ${WRIKE_SPACE_ID}...`);
        const data = await fetchWithRetry(`https://www.wrike.com/api/v4/spaces/${WRIKE_SPACE_ID}/folders`);

        if (!data.data) {
            console.warn("⚠️ Aucun folder trouvé dans l'espace.");
            return [];
        }

        return data.data.map(folder => folder.id);
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des folders :", error.message);
        return [];
    }
};

// 🔹 Récupérer les informations d'un folder spécifique avec gestion des erreurs 429
const fetchFolderDetails = async (folderId) => {
    try {
        const url = `https://www.wrike.com/api/v4/folders/${folderId}`;
        const data = await fetchWithRetry(url);
        return data.data[0];
    } catch (error) {
        console.error(`❌ Erreur lors de la récupération du folder ${folderId} :`, error.message);
        return null;
    }
};

// 🔹 Récupérer et stocker tous les folders d'un espace dans la BDD
const fetchAndStoreWrikeData = async () => {
    try {
        console.log("🚀 Début de la récupération des projets Wrike...");

        await createTableIfNotExists();

        const { customFieldMap, customFieldTypes } = await fetchCustomFieldsMapping();
        await ensureColumnsExist(customFieldTypes);

        const folderIds = await fetchFoldersFromSpace();

        let totalRecords = 0;

        for (const folderId of folderIds) {
            console.log(`📁 Traitement du folder Wrike ID: ${folderId}`);

            const folder = await fetchFolderDetails(folderId);
            if (!folder || !folder.title.startsWith("MP-")) continue;

            await sleep(100); // Délai pour éviter les erreurs 429

            const fmNoCom = extractFMNoCom(folder.title);
            const fmLink = extractFMLink(folder.title);
            const customFieldValues = {};
            for (const cf of folder.customFields || []) {
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

            const fields = ["ID", "Permalink", "AccountId", "Title","FM_NoCom", "FM_LINK", "CreatedDate", "UpdatedDate", "WorkflowId", ...Object.keys(customFieldValues)];
            const placeholders = fields.map(() => "?").join(", ");
            const values = [folder.id, folder.permalink, folder.accountId, folder.title, fmNoCom, fmLink, formatDateForMySQL(folder.createdDate), formatDateForMySQL(folder.updatedDate), folder.workflowId, ...Object.values(customFieldValues)];

            await db.execute(`
                INSERT INTO wrike_projects_active (${fields.join(", ")}) VALUES (${placeholders})
                ON DUPLICATE KEY UPDATE ${fields.map(col => `${col} = VALUES(${col})`).join(", ")}
            `, values);

            totalRecords++;
        }

        console.log(`📦 ${totalRecords} folders Wrike enregistrés.`);
    } catch (error) {
        console.error("❌ Erreur lors de l'insertion des données Wrike :", error.message);
    }
};

module.exports = { fetchAndStoreWrikeData };
