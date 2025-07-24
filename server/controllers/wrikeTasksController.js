//wrikeTasksController.js
const axios = require('axios');
const db = require('../config/db');

const WRIKE_API_TOKEN = process.env.WRIKE_API_TOKEN;
const HEADERS = {
    Authorization: `Bearer ${WRIKE_API_TOKEN}`,
    'Content-Type': 'application/json'
};

// 🔹 Fonction pour obtenir la date des 3 derniers jours au format ISO
const getThreeDaysAgoDate = () => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 3);
    return date.toISOString().split('T')[0]; // Récupérer uniquement la date (YYYY-MM-DD)
};

const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
};

// 🔹 Fonction pour formater une date ISO en format YYYY-MM-DD (sans l’heure)
const formatDateForMySQL = (isoDate) => {
    if (!isoDate || isoDate.trim() === "") return null;
    return isoDate.split('T')[0]; // Garder uniquement la date
};

// 🔹 Fonction pour formater les noms de colonnes pour la base de données
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
            return 'DATE';
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

// 🔹 Extraire Task_Description : on retire tous les blocs [MP-...] même mal fermés
const extractTaskDescription = (title) => {
    return title
        .replace(/\[(MP-[^\]]*?)\]/gi, '')  // Supprime [MP-....]
        .replace(/(MP-[^\]\s]+)\s*/gi, '') // Supprime les MP-... sans crochets
        .replace(/^\s*[-–]\s*/, '')        // Supprime les tirets de séparation
        .trim();
};

// 🔹 Extraire FM_NoCom : basé sur ce qui suit MP- (alphanumérique, avant un tiret si présent)
const extractFMNoCom = (title) => {
    const match = title.match(/MP-([A-Z#0-9]+)/i);
    if (!match) return null;

    const baseCode = match[1].split('-')[0].toUpperCase();
    return `0000${baseCode}`;
};
//https://www.wrike.com/api/v4/tasks?createdDate={"start":"2017-01-01T00:00:00Z"}&fields=["parentIds","customFields"]
//https://www.wrike.com/api/v4/tasks?updatedDate={"start":"2024-03-14T00:00:00Z","end":"2024-03-17T23:59:59Z"}&fields=["parentIds","customFields"]

// 🔹 Création de la table `wrike_tasks` si elle n'existe pas
const createWrikeTasksTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS wrike_tasks (
                Id VARCHAR(50) PRIMARY KEY,
                AccountId VARCHAR(50),
                Title TEXT,
                Status VARCHAR(100),
                Importance VARCHAR(100),
                Permalink TEXT,
                CustomStatusId VARCHAR(50),
                CompletedDate DATE,
                CreatedDate DATE,
                UpdatedDate DATE,
                FM_NoCom VARCHAR(50),
                FM_LINK VARCHAR(100),
                Task_Due DATE,
                Task_Start DATE,
                Task_Duration INT,
                Task_Description TEXT,
                ParentIds TEXT,
                Task_datecount INT
            )
        `);
        console.log("✅ Table `wrike_tasks` vérifiée/créée.");
    } catch (error) {
        console.error("❌ Erreur lors de la création de la table `wrike_tasks` :", error.message);
    }
};

// 🔹 Récupérer la liste des Custom Fields de Wrike et les ajouter à la table
const ensureCustomFieldsExist = async () => {
    try {
        console.log("🔄 Vérification des champs personnalisés...");

        const response = await axios.get("https://www.wrike.com/api/v4/customfields", { headers: HEADERS });
        const data = response.data;
        if (!data || !data.data) {
            console.warn("⚠️ Aucun champ personnalisé récupéré.");
            return {};
        }

        const [rows] = await db.execute("SHOW COLUMNS FROM wrike_tasks");
        const existingColumns = rows.map(row => row.Field);

        const customFieldMap = {};
        const customFieldTypes = {};

        for (const field of data.data) {
            const columnName = formatColumnName(field.title);
            const columnType = mapWrikeTypeToSQL(field.type);

            if (!existingColumns.includes(columnName)) {
                await db.execute(`ALTER TABLE wrike_tasks ADD COLUMN ${columnName} ${columnType}`);
                console.log(`✅ Nouvelle colonne ajoutée : ${columnName} (${columnType})`);
            }
            customFieldMap[field.id] = columnName;
            customFieldTypes[columnName] = columnType;
        }

        return { customFieldMap, customFieldTypes };
    } catch (error) {
        console.error("❌ Erreur lors de la vérification des champs personnalisés :", error.message);
        return { customFieldMap: {}, customFieldTypes: {} };
    }
};


// 🔹 Fonction pour ajuster dynamiquement la période de récupération
const adjustRetrievalPeriod = async (startDate, customFieldMap, customFieldTypes) => {
    let period = 6; // Période initiale de récupération (6 jours)
    let totalFetched = 0;
    let today = new Date();

    while (startDate <= today) {
        let endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + period);
        if (endDate > today) endDate = today; // Éviter de dépasser la date actuelle

        let startStr = startDate.toISOString().split("T")[0] + "T00:00:00Z";
        let endStr = endDate.toISOString().split("T")[0] + "T23:59:59Z";

        console.log(`📅 Récupération des tâches du ${startStr} au ${endStr}...`);

        let url = `https://www.wrike.com/api/v4/tasks?createdDate={"start":"${startStr}","end":"${endStr}"}&fields=["parentIds","customFields"]`;
        const response = await axios.get(url, { headers: HEADERS });

        const tasks = response.data?.data || [];
        console.log(`📥 ${tasks.length} tâches récupérées.`);

        for (const task of tasks) {
            await insertOrUpdateTask(task, customFieldMap, customFieldTypes);
        }

        totalFetched += tasks.length;

        // ⚠️ Si on atteint 1000 tâches récupérées, réduire temporairement la période à 2 jours
        if (tasks.length === 1000) {
            console.warn("⚠️ 1000 tâches récupérées, réduction de la période à 2 jours pour éviter les pertes.");
            period = 2;
        }

        // ✅ Si la période a été réduite et que moins de 1000 tâches sont récupérées, retour à 6 jours
        if (period === 2 && tasks.length < 1000) {
            console.log("✅ Toutes les tâches ont été récupérées, retour à une période de 6 jours.");
            period = 6;
        }

        // ⏩ Passer à la prochaine période
        startDate.setDate(startDate.getDate() + period);
    }

    console.log(`✅ Récupération terminée avec ${totalFetched} tâches Wrike enregistrées.`);
};

// 🔹 Fonction principale pour récupérer et stocker les tâches Wrike
const fetchAndStoreWrikeTasks = async () => {
    try {
        console.log("🚀 Démarrage de la récupération complète des tâches Wrike...");

        // 1️⃣ Création de la table si elle n'existe pas
        await createWrikeTasksTable();

        // 2️⃣ Vérification et récupération des champs personnalisés
        const { customFieldMap, customFieldTypes } = await ensureCustomFieldsExist();

        // 3️⃣ Lancer la récupération avec ajustement dynamique
        let startDate = new Date("2017-06-23");
        await adjustRetrievalPeriod(startDate, customFieldMap, customFieldTypes);

    } catch (error) {
        console.error("❌ Erreur lors de l'insertion des données Wrike :", error.message);
    }
};


// 🔹 Fonction d'insertion / mise à jour des tâches
const insertOrUpdateTask = async (task, customFieldMap, customFieldTypes) => {
    try {
        if (!task.id || !task.accountId || !task.title) return;

        // 📌 **Nouveau Filtrage : Ne traiter que les tâches commençant par `[MP-`**
        if (!task.title.startsWith("[MP-")) {
            //console.warn(`⏩ Tâche ignorée car son titre ne commence pas par "[MP-": ${task.title}`);
            return;
        }

        // Extraction des champs spécifiques
        const fmNoCom = extractFMNoCom(task.title);
        const fmLink = extractFMLink(task.title);
        const taskDescription = extractTaskDescription(task.title);
        const parentIds = task.parentIds?.join(', ') || null;

        // Formatage des dates
        const createdDate = formatDateForMySQL(task.createdDate) || null;
        const updatedDate = formatDateForMySQL(task.updatedDate) || null;
        const completedDate = task.completedDate ? formatDateForMySQL(task.completedDate) : null;
        const taskDue = task.dates?.due ? formatDateForMySQL(task.dates.due) : null;
        const taskStart = task.dates?.start ? formatDateForMySQL(task.dates.start) : null;

        // Calcul du `Task_datecount`
        const taskDateCount = [createdDate, updatedDate, taskDue].filter(date => date !== null).length;
        const taskDuration = task.dates?.duration !== undefined ? task.dates.duration : null;
        // Préparation des champs et valeurs pour l'INSERT / UPDATE
        const fields = [
            "ID",
            "AccountId",
            "Title",
            "Status",
            "Importance",
            "Permalink",
            "CustomStatusId",
            "CompletedDate",
            "CreatedDate",
            "UpdatedDate",
            "FM_NoCom",
            "FM_LINK",
            "Task_Due",
            "Task_Start",
            "Task_Duration",
            "Task_Description",
            "ParentIds",
            "Task_datecount"
        ];
        const values = [
            task.id,
            task.accountId,
            task.title,
            task.status || null,
            task.importance || null,
            task.permalink || null,
            task.customStatusId || null,
            completedDate,
            createdDate,
            updatedDate,
            fmNoCom,
            fmLink,
            taskDue,
            taskStart,
            task.dates.duration,
            taskDescription,
            parentIds,
            taskDateCount
        ];

        // Ajout des champs personnalisés
        for (const field of task.customFields || []) {
            if (customFieldMap[field.id]) {
                let value = field.value !== undefined ? field.value : null;

                // Adaptation des types de données
                if (customFieldTypes[customFieldMap[field.id]] === 'DATE') {
                    value = formatDateForMySQL(value);
                } else if (customFieldTypes[customFieldMap[field.id]] === 'DECIMAL(15,2)') {
                    value = (value === "" || value === null) ? null : parseFloat(value);
                } else if (customFieldTypes[customFieldMap[field.id]] === 'BOOLEAN') {
                    value = value === true ? 1 : value === false ? 0 : null;
                }

                fields.push(customFieldMap[field.id]);
                values.push(value);
            }
        }

        // ✅ Vérification avant l'insertion pour éviter tout `undefined`
        values.forEach((val, index) => {
            if (val === undefined) {
                //console.warn(`⚠️ Valeur undefined détectée dans ${fields[index]}, remplacement par NULL.`);
                values[index] = null;
            }
        });


        // Construction de la requête SQL
        const placeholders = fields.map(() => "?").join(", ");
        const updateFields = fields.map(col => `${col} = VALUES(${col})`).join(", ");

        await db.execute(`
            INSERT INTO wrike_tasks (${fields.join(", ")}) 
            VALUES (${placeholders}) 
            ON DUPLICATE KEY UPDATE ${updateFields}
        `, values);

    } catch (error) {
        console.error(`❌ Erreur lors de l'insertion/mise à jour de la tâche ${task.id} :`, error.message);
    }
};
// 🔹 Fonction pour mettre à jour uniquement les tâches des 3 derniers jours
const updateRecentWrikeTasks = async () => {
    try {
        console.log("🔄 Mise à jour des tâches Wrike des 3 derniers jours avec gestion avancée de la pagination...");

        // 1️⃣ Récupération de la date des 3 derniers jours
        let startDate = new Date();
        startDate.setUTCDate(startDate.getUTCDate() - 3);
        let today = new Date();
        let period = 3; // Intervalle initial : 3 jours

        let totalTasksFetched = 0; // Suivi du total des tâches mises à jour

        // 2️⃣ Récupération des Custom Fields et leur mapping
        const { customFieldMap, customFieldTypes } = await ensureCustomFieldsExist();

        while (startDate <= today) {
            let endDate = new Date(startDate);
            endDate.setUTCDate(startDate.getUTCDate() + period);
            if (endDate > today) endDate = today;

            let startStr = startDate.toISOString().split("T")[0] + "T00:00:00Z";
            let endStr = endDate.toISOString().split("T")[0] + "T23:59:59Z";

            console.log(`📅 Récupération des tâches mises à jour du ${startStr} au ${endStr}...`);

            let totalFetchedForPeriod = 0;

            // 3️⃣ Pagination via nextPageToken
            let nextPageToken = null;
            let retryCount = 0;

            do {
                try {
                    // 4️⃣ Construction de l'URL avec pagination
                    let url = `https://www.wrike.com/api/v4/tasks?updatedDate={"start":"${startStr}","end":"${endStr}"}&fields=["parentIds","customFields"]&pageSize=1000`;
                    if (nextPageToken) {
                        url += `&nextPageToken=${nextPageToken}`;
                    }

                    // 5️⃣ Appel API avec gestion des erreurs
                    const response = await axios.get(url, { headers: HEADERS });
                    const tasks = response.data?.data || [];
                    nextPageToken = response.data?.nextPageToken || null;

                    console.log(`📥 Page récupérée: ${tasks.length} tâches.`);

                    // 6️⃣ Mise à jour des tâches récupérées
                    for (const task of tasks) {
                        await insertOrUpdateTask(task, customFieldMap, customFieldTypes);
                    }

                    totalFetchedForPeriod += tasks.length;
                    totalTasksFetched += tasks.length;
                    retryCount = 0; // Réinitialiser les tentatives après un succès

                } catch (error) {
                    console.error(`❌ Erreur lors de la récupération des tâches (Tentative ${retryCount + 1})`, error.message);

                    if (retryCount < 3) {
                        console.warn("🔄 Nouvelle tentative après erreur...");
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, 5000)); // Attente de 5 secondes avant de réessayer
                    } else {
                        console.error("⛔ Abandon après 3 tentatives.");
                        break;
                    }
                }

            } while (nextPageToken); // Continuer tant que `nextPageToken` est présent

            console.log(`✅ Période ${startStr} -> ${endStr} : ${totalFetchedForPeriod} tâches enregistrées.`);

            // 7️⃣ Passer à la période suivante
            startDate.setUTCDate(startDate.getUTCDate() + period);
        }

        console.log(`✅ Mise à jour terminée : ${totalTasksFetched} tâches Wrike mises à jour.`);

    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour des tâches Wrike :", error.message);
    }
};



// 🔄 Planification automatique toutes les 30 minutes
//setInterval(fetchAndStoreWrikeTasks, 30 * 60 * 1000);

module.exports = { fetchAndStoreWrikeTasks, createWrikeTasksTable, updateRecentWrikeTasks };
