
// controllers/wrikeControllerProjectsAnnulesTermines.js

const axios = require('axios');
const db = require('../config/db');

const WRIKE_API_TOKEN = process.env.WRIKE_API_TOKEN;
const HEADERS = {
    Authorization: `Bearer ${WRIKE_API_TOKEN}`,
    'Content-Type': 'application/json'
};

// 🔹 Espaces Wrike pour les projets annulés et terminés
const SPACES = {
    ANNULES: "IEABSP7AI46SDQ3Q",
    TERMINES: "IEABSP7AI4V4NVHE"
};

// 🔹 Fonction pour attendre un certain temps (délai entre les requêtes)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🔹 Fonction qui gère les appels API avec retry en cas d’erreur 429 (Rate Limit Exceeded)
const fetchWithRetry = async (url, maxRetries = 5, delay = 500) => {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await axios.get(url, { headers: HEADERS });
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                attempt++;
                const waitTime = delay * (2 ** attempt);
                console.warn(`⚠️ API rate limit atteint (429). Tentative ${attempt}/${maxRetries}. Réessai dans ${waitTime / 1000} sec...`);
                await sleep(waitTime);
            } else {
                throw error;
            }
        }
    }

    throw new Error(`❌ Échec après ${maxRetries} tentatives (Erreur 429)`);
};

// 🔹 Fonction pour créer une table si elle n'existe pas
const createTableIfNotExists = async (tableName) => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
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
        console.log(`✅ Table '${tableName}' vérifiée/créée.`);
    } catch (error) {
        console.error(`❌ Erreur lors de la création de la table '${tableName}' :`, error.message);
    }
};

// 🔹 Fonction pour récupérer les dossiers d'un espace Wrike
const fetchFoldersFromSpace = async (spaceId) => {
    try {
        console.log(`🔄 Récupération des folders pour l'espace ${spaceId}...`);
        const url = `https://www.wrike.com/api/v4/spaces/${spaceId}/folders`;
        const data = await fetchWithRetry(url);

        return data.data?.map(folder => folder.id) || [];
    } catch (error) {
        console.error(`❌ Erreur lors de la récupération des folders de l'espace ${spaceId} :`, error.message);
        return [];
    }
};

// 🔹 Fonction pour récupérer les détails d'un folder spécifique
const fetchFolderDetails = async (folderId) => {
    try {
        console.log(`🔄 Récupération des détails du folder ${folderId}...`);
        const url = `https://www.wrike.com/api/v4/folders/${folderId}`;
        const data = await fetchWithRetry(url);
        return data.data?.[0] || null;
    } catch (error) {
        console.error(`❌ Erreur lors de la récupération du folder ${folderId} :`, error.message);
        return null;
    }
};

// 🔹 Fonction pour formater une date ISO en DATETIME MySQL
const formatDateForMySQL = (isoDate) => isoDate ? isoDate.replace("T", " ").replace("Z", "") : null;
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


// 🔹 Fonction pour formater les noms de colonnes pour la base de données
const formatColumnName = (title) => 'custom_' + title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');

// 🔹 Fonction pour convertir les types Wrike en types SQL
const mapWrikeTypeToSQL = (wrikeType) => {
    switch (wrikeType) {
        case 'Numeric': case 'Percentage': case 'Currency': return 'DECIMAL(15,2)';
        case 'Date': return 'DATETIME';
        case 'Checkbox': return 'BOOLEAN';
        case 'DropDown': case 'Text': default: return 'TEXT';
    }
};

// 🔹 Fonction pour récupérer et ajouter les colonnes des custom fields
const ensureCustomFieldsExist = async (tableName) => {
    try {
        console.log(`🔍 Vérification des champs personnalisés pour '${tableName}'...`);
        const response = await axios.get("https://www.wrike.com/api/v4/customfields", { headers: HEADERS });
        const data = response.data;

        const [rows] = await db.execute(`SHOW COLUMNS FROM ${tableName}`);
        const existingColumns = rows.map(row => row.Field);

        const customFieldMap = {};
        const customFieldTypes = {};

        for (const field of data.data || []) {
            const columnName = formatColumnName(field.title);
            if (!existingColumns.includes(columnName)) {
                const columnType = mapWrikeTypeToSQL(field.type);
                await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
                console.log(`✅ Nouvelle colonne ajoutée : ${columnName} (${columnType})`);
            }
            customFieldMap[field.id] = columnName;
            customFieldTypes[columnName] = mapWrikeTypeToSQL(field.type);
        }

        return { customFieldMap, customFieldTypes };
    } catch (error) {
        console.error(`❌ Erreur lors de la vérification des champs personnalisés dans '${tableName}' :`, error.message);
        return { customFieldMap: {}, customFieldTypes: {} };
    }
};

// 🔹 Fonction pour insérer/mettre à jour des projets dans une table spécifique
const upsertProjects = async (projects, tableName, customFieldMap, customFieldTypes) => {
    try {
        let totalRecords = 0;

        for (const project of projects) {
            if (!project.id || !project.permalink || !project.accountId || !project.title) {
                console.warn(`⚠️ Projet ${project.id} ignoré (données incomplètes).`);
                continue;
            }

            const fmNoCom = extractFMNoCom(project.title);
            const fmLink = extractFMLink(project.title);
            const customFieldValues = {};

            // Traiter les Custom Fields et adapter les types
            for (const cf of project.customFields || []) {
                if (customFieldMap[cf.id]) {
                    let value = cf.value !== undefined ? cf.value : null;

                    if (customFieldTypes[customFieldMap[cf.id]] === 'DATETIME') {
                        value = formatDateForMySQL(value);
                    }
                    if (customFieldTypes[customFieldMap[cf.id]] === 'DECIMAL(15,2)') {
                        value = (value === "" || value === null) ? null : parseFloat(value);
                    }else if (customFieldTypes[customFieldMap[cf.id]] === 'BOOLEAN' || customFieldTypes[customFieldMap[cf.id]] === 'TINYINT(1)') {
                        // Convertir les booléens en 1 ou 0 pour MySQL
                        value = value === true ? 1 : value === false ? 0 : null;
                    }

                    customFieldValues[customFieldMap[cf.id]] = value;
                }
            }

            const fields = ["ID", "Permalink", "AccountId", "Title", "FM_NoCom", "FM_LINK", "CreatedDate", "UpdatedDate", "WorkflowId", ...Object.keys(customFieldValues)];
            const placeholders = fields.map(() => "?").join(", ");
            const values = [
                project.id,
                project.permalink,
                project.accountId,
                project.title,
                fmNoCom,
                fmLink,
                formatDateForMySQL(project.createdDate),
                formatDateForMySQL(project.updatedDate),
                project.workflowId,
                ...Object.values(customFieldValues)
            ];

            const updateFields = fields.map(col => `${col} = VALUES(${col})`).join(", ");

            await db.execute(`
                INSERT INTO ${tableName} (${fields.join(", ")}) VALUES (${placeholders})
                ON DUPLICATE KEY UPDATE ${updateFields}
            `, values);

            totalRecords++;
        }

        console.log(`✅ ${totalRecords} projets mis à jour dans '${tableName}'.`);
    } catch (error) {
        console.error(`❌ Erreur lors de l'insertion des données dans '${tableName}' :`, error.message);
    }
};

// 🔹 Fonction principale pour récupérer et stocker les données de Wrike
const syncWrikeProjects = async () => {
    console.log("🚀 Début de la synchronisation des projets Wrike...");

    // Création des tables si elles n'existent pas
    await createTableIfNotExists("wrike_projects_annules");
    await createTableIfNotExists("wrike_projects_termines");

    // Vérification et ajout des champs personnalisés
    const { customFieldMap: customFieldMapAnnules, customFieldTypes: customFieldTypesAnnules } = await ensureCustomFieldsExist("wrike_projects_annules");
    const { customFieldMap: customFieldMapTermines, customFieldTypes: customFieldTypesTermines } = await ensureCustomFieldsExist("wrike_projects_termines");

    // Récupération des dossiers Wrike
    const annulesFolderIds = await fetchFoldersFromSpace(SPACES.ANNULES);
    const terminesFolderIds = await fetchFoldersFromSpace(SPACES.TERMINES);

    let annulesProjects = [];
    let terminesProjects = [];

    for (const folderId of annulesFolderIds) {
        const folder = await fetchFolderDetails(folderId); // Utilisation de fetchFolderDetails
        if (folder && folder.title.startsWith("MP-")) {
            annulesProjects.push(folder);
        }
    }

    for (const folderId of terminesFolderIds) {
        const folder = await fetchFolderDetails(folderId); // Utilisation de fetchFolderDetails
        if (folder && folder.title.startsWith("MP-")) {
            terminesProjects.push(folder);
        }
    }

    console.log(`📂 ${annulesProjects.length} projets annulés récupérés.`);
    console.log(`📂 ${terminesProjects.length} projets terminés récupérés.`);

    // Insérer les projets récupérés dans la BDD
    await upsertProjects(annulesProjects, "wrike_projects_annules", customFieldMapAnnules, customFieldTypesAnnules);
    await upsertProjects(terminesProjects, "wrike_projects_termines", customFieldMapTermines, customFieldTypesTermines);

    console.log("✅ Synchronisation des projets Wrike terminée.");
};

// 🔹 Fonction pour nettoyer `wrike_projects_active`
const cleanActiveProjects = async () => {
    console.log("🔄 Suppression des projets actifs annulés ou terminés...");
    await db.execute("DELETE FROM wrike_projects_active WHERE ID IN (SELECT ID FROM wrike_projects_annules UNION SELECT ID FROM wrike_projects_termines)");
    console.log("✅ Nettoyage terminé !");
};

// 🔹 Fonction pour synchroniser tous les projets
const createWrikeTableAnnuleTermine = async () => {
    await syncWrikeProjects();
    await cleanActiveProjects();
};

module.exports = { createWrikeTableAnnuleTermine };

//3124
//122