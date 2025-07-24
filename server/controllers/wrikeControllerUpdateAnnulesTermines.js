//wrikeControllerUpdateAnnulesTermines.js
const axios = require('axios');
const db = require('../config/db');

const WRIKE_API_TOKEN = process.env.WRIKE_API_TOKEN;
const HEADERS = {
    Authorization: `Bearer ${WRIKE_API_TOKEN}`,
    'Content-Type': 'application/json'
};

// 🔹 Espaces Wrike
const SPACES = {
    ANNULES: "IEABSP7AI46SDQ3Q",
    TERMINES: "IEABSP7AI4V4NVHE"
};

// 🔹 Fonction pour obtenir la date des 3 derniers jours au format ISO
const getThreeDaysAgoDate = () => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 3);
    return date.toISOString().split('.')[0] + "Z";
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


// 🔹 Fonction pour récupérer les projets créés ou mis à jour dans les 3 derniers jours
const fetchRecentProjectsFromSpace = async (spaceId) => {
    try {
        console.log(`🔄 Récupération des projets mis à jour ces 3 derniers jours pour l'espace ${spaceId}...`);

        const updatedDate = getThreeDaysAgoDate();
        const url = `https://www.wrike.com/api/v4/spaces/${spaceId}/folders?fields=["customFields"]&updatedDate={"start":"${updatedDate}"}`;

        const response = await axios.get(url, { headers: HEADERS });

        return response.data?.data || [];
    } catch (error) {
        console.error(`❌ Erreur lors de la récupération des projets mis à jour pour l'espace ${spaceId} :`, error.message);
        return [];
    }
};

// 🔹 Fonction pour récupérer les custom fields et ajouter les colonnes manquantes
const ensureCustomFieldsExist = async (tableName) => {
    try {
        console.log(`🔍 Vérification des nouveaux champs personnalisés pour '${tableName}'...`);

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
                console.log(`✅ Nouveau champ ajouté : ${columnName} (${columnType})`);
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

// 🔹 Fonction pour insérer/mettre à jour des projets avec `customFieldTypes`
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
                    } else if (customFieldTypes[customFieldMap[cf.id]] === 'BOOLEAN') {
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

// 🔹 Fonction principale pour mettre à jour les projets récents et nettoyer la BDD
const syncWrikeAnnuleTermineAndCleanActive = async () => {
    console.log("🚀 Lancement de la mise à jour des projets annulés et terminés...");

    const { customFieldMap: customFieldMapAnnules, customFieldTypes: customFieldTypesAnnules } = await ensureCustomFieldsExist("wrike_projects_annules");
    const { customFieldMap: customFieldMapTermines, customFieldTypes: customFieldTypesTermines } = await ensureCustomFieldsExist("wrike_projects_termines");

    const annulesProjects = await fetchRecentProjectsFromSpace(SPACES.ANNULES);
    const terminesProjects = await fetchRecentProjectsFromSpace(SPACES.TERMINES);

    await upsertProjects(annulesProjects, "wrike_projects_annules", customFieldMapAnnules, customFieldTypesAnnules);
    await upsertProjects(terminesProjects, "wrike_projects_termines", customFieldMapTermines, customFieldTypesTermines);

    console.log("✅ Mise à jour des projets terminée.");

    console.log("🔄 Suppression des projets actifs...");
    await db.execute(`
        DELETE FROM wrike_projects_active 
        WHERE ID IN (
            SELECT ID FROM wrike_projects_annules
            UNION 
            SELECT ID FROM wrike_projects_termines
        )
    `);
    console.log("✅ Nettoyage terminé !");
};

// 🔹 Exécuter toutes les 30 minutes
//setInterval(syncWrikeAnnuleTermineAndCleanActive, 30 * 60 * 1000);

module.exports = { syncWrikeAnnuleTermineAndCleanActive };
