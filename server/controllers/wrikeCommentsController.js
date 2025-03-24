//wrikeCommentsController.js
const axios = require('axios');
const db = require('../config/db');

const WRIKE_API_TOKEN = process.env.WRIKE_API_TOKEN;
const HEADERS = {
    Authorization: `Bearer ${WRIKE_API_TOKEN}`,
    'Content-Type': 'application/json'
};

// 🔹 Création de la table `wrike_comments` si elle n'existe pas
const createWrikeCommentsTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS wrike_comments (
                Id VARCHAR(50) PRIMARY KEY,
                AuthorId VARCHAR(50),
                TaskId VARCHAR(50) NULL,
                FolderId_Active VARCHAR(50) NULL,
                FolderId_Annules VARCHAR(50) NULL,
                FolderId_Termines VARCHAR(50) NULL,
                Text TEXT,
                UpdatedDate DATE,
                CreatedDate DATE,
                FOREIGN KEY (TaskId) REFERENCES wrike_tasks(Id) ON DELETE CASCADE,
                FOREIGN KEY (FolderId_Active) REFERENCES wrike_projects_active(Id) ON DELETE CASCADE,
                FOREIGN KEY (FolderId_Annules) REFERENCES wrike_projects_annules(Id) ON DELETE CASCADE,
                FOREIGN KEY (FolderId_Termines) REFERENCES wrike_projects_termines(Id) ON DELETE CASCADE
            )
        `);
        console.log("✅ Table `wrike_comments` vérifiée/créée.");
    } catch (error) {
        console.error("❌ Erreur lors de la création de la table `wrike_comments` :", error.message);
    }
};


const insertOrUpdateComment = async (comment) => {
    try {
        let {
            id,
            authorId,
            text,
            updatedDate,
            createdDate,
            taskId,
            folderId
        } = comment;

        text = text || null;
        authorId = authorId || null;
        taskId = taskId || null;
        folderId = folderId || null;

        const formatDate = (isoDate) => {
            return isoDate ? isoDate.split('T')[0] : null;
        };

        updatedDate = formatDate(updatedDate);
        createdDate = formatDate(createdDate);

        let folderIdActive = null;
        let folderIdAnnules = null;
        let folderIdTermines = null;

        let taskExists = false;

        if (taskId) {
            const [taskCheck] = await db.execute(`SELECT Id FROM wrike_tasks WHERE Id = ? LIMIT 1`, [taskId]);
            if (taskCheck.length > 0) {
                taskExists = true;
            } else {
                taskId = null; // invalide, on annule la liaison
            }
        }

        if (!taskExists && folderId) {
            const [active] = await db.execute(`SELECT Id FROM wrike_projects_active WHERE Id = ? LIMIT 1`, [folderId]);
            const [annules] = await db.execute(`SELECT Id FROM wrike_projects_annules WHERE Id = ? LIMIT 1`, [folderId]);
            const [termines] = await db.execute(`SELECT Id FROM wrike_projects_termines WHERE Id = ? LIMIT 1`, [folderId]);

            if (active.length > 0) folderIdActive = folderId;
            else if (annules.length > 0) folderIdAnnules = folderId;
            else if (termines.length > 0) folderIdTermines = folderId;
            else {
                console.warn(`⚠️ Commentaire ${id} ignoré : n'appartient ni à une tâche ni à un projet valide.`);
                return;
            }
        } else if (!taskExists && !folderId) {
            console.warn(`⚠️ Commentaire ${id} ignoré : aucun TaskId ni FolderId valide.`);
            return;
        }

        await db.execute(`
            INSERT INTO wrike_comments (
                Id, AuthorId, TaskId, FolderId_Active, FolderId_Annules, FolderId_Termines,
                Text, UpdatedDate, CreatedDate
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                AuthorId = VALUES(AuthorId), 
                TaskId = VALUES(TaskId), 
                FolderId_Active = VALUES(FolderId_Active),
                FolderId_Annules = VALUES(FolderId_Annules),
                FolderId_Termines = VALUES(FolderId_Termines),
                Text = VALUES(Text),
                UpdatedDate = VALUES(UpdatedDate),
                CreatedDate = VALUES(CreatedDate)
        `, [
            id, authorId, taskId, folderIdActive, folderIdAnnules, folderIdTermines,
            text, updatedDate, createdDate
        ]);

    } catch (error) {
        console.error(`❌ Erreur lors de l'insertion/mise à jour du commentaire ${comment.id} :`, error.message);
    }
};



// 🔹 Fonction pour insérer ou mettre à jour un **commentaire**
// const insertOrUpdateComment = async (comment) => {
//     try {
//         let { id, authorId, text, updatedDate, createdDate, taskId } = comment;

//         // ✅ Assurer que les champs non définis sont remplacés par `null`
//         text = text || null;
//         authorId = authorId || null;
//         taskId = taskId || null; // Certains commentaires peuvent ne pas être liés à une tâche.

//         // ✅ Convertir les dates au format MySQL `YYYY-MM-DD HH:MM:SS`
//         const formatDateForMySQL = (isoDate) => {
//             return isoDate ? isoDate.replace("T", " ").replace("Z", "") : null;
//         };

//         updatedDate = formatDateForMySQL(updatedDate);
//         createdDate = formatDateForMySQL(createdDate);

//         // ✅ Vérifier si `TaskId` existe avant insertion (sauf si null)
//         if (taskId) {
//             const [taskExists] = await db.execute(`SELECT Id FROM wrike_tasks WHERE Id = ? LIMIT 1`, [taskId]);

//             if (taskExists.length === 0) {
//                 console.warn(`⚠️ Ignoré : La tâche ${taskId} n'existe pas dans wrike_tasks.`);
//                 return;
//             }
//         }

//         // ✅ Insertion en base de données
//         await db.execute(`
//             INSERT INTO wrike_comments (Id, AuthorId, TaskId, Text, UpdatedDate, CreatedDate)
//             VALUES (?, ?, ?, ?, ?, ?)
//             ON DUPLICATE KEY UPDATE 
//             AuthorId = VALUES(AuthorId), 
//             TaskId = VALUES(TaskId), 
//             Text = VALUES(Text),
//             UpdatedDate = VALUES(UpdatedDate),
//             CreatedDate = VALUES(CreatedDate)
//         `, [id, authorId, taskId, text, updatedDate, createdDate]);

//     } catch (error) {
//         console.error(`❌ Erreur lors de l'insertion/mise à jour du commentaire ${comment.id} :`, error.message);
//     }
// };


// 🔹 Fonction pour récupérer **tous** les commentaires Wrike (chargement initial)
const fetchAndStoreAllWrikeComments = async () => {
    try {
        console.log("🚀 Démarrage de la récupération complète des commentaires Wrike...");

        await createWrikeCommentsTable();
        let totalCommentsFetched = 0;
        let nextPageToken = null;

        do {
            try {
                // ✅ Suppression de `pageSize`
                let url = `https://www.wrike.com/api/v4/comments?plainText=true`;

                if (nextPageToken) {
                    url += `&nextPageToken=${nextPageToken}`;
                }

                const response = await axios.get(url, { headers: HEADERS });
                if (!response.data || !response.data.data) {
                    throw new Error("Réponse invalide de l'API Wrike.");
                }

                const comments = response.data.data;
                nextPageToken = response.data.nextPageToken || null;

                console.log(`📥 Page récupérée: ${comments.length} commentaires.`);

                for (const comment of comments) {
                    await insertOrUpdateComment(comment);
                }

                totalCommentsFetched += comments.length;

            } catch (error) {
                console.error("❌ Erreur lors de la récupération des commentaires Wrike :", error.message);
                break;
            }

        } while (nextPageToken); 

        console.log(`✅ Récupération terminée : ${totalCommentsFetched} commentaires Wrike enregistrés.`);

    } catch (error) {
        console.error("❌ Erreur lors de la récupération complète des commentaires Wrike :", error.message);
    }
};


// 🔹 Fonction pour récupérer **les commentaires des 3 derniers jours**
// 🔹 Fonction pour récupérer **les commentaires des 3 derniers jours**
const updateRecentWrikeComments = async () => {
    try {
        console.log("🔄 Mise à jour des commentaires Wrike des 3 derniers jours...");

        await createWrikeCommentsTable();

        // 📅 Calcul de la date de début (3 jours en arrière)
        const threeDaysAgo = new Date();
        threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
        const startDate = threeDaysAgo.toISOString().split('.')[0] + "Z"; // Format correct sans millisecondes
        const today = new Date().toISOString().split('.')[0] + "Z"; // Format correct sans millisecondes

        let totalCommentsUpdated = 0;
        let nextPageToken = null;

        do {
            try {
                // ✅ Utilisation du format d'URL qui fonctionne
                let url = `https://www.wrike.com/api/v4/comments?plainText=true&updatedDate={"start":"${startDate}","end":"${today}"}`;

                if (nextPageToken) {
                    url += `&nextPageToken=${nextPageToken}`;
                }

                const response = await axios.get(url, { headers: HEADERS });
                
                if (!response.data || !response.data.data) {
                    throw new Error("Réponse invalide de l'API Wrike.");
                }

                const comments = response.data.data;
                nextPageToken = response.data.nextPageToken || null;

                console.log(`📥 Page récupérée: ${comments.length} commentaires.`);

                for (const comment of comments) {
                    await insertOrUpdateComment(comment);
                }

                totalCommentsUpdated += comments.length;

            } catch (error) {
                console.error("❌ Erreur lors de la mise à jour des commentaires Wrike :", error.message);
                break;
            }

        } while (nextPageToken); 

        console.log(`✅ Mise à jour terminée : ${totalCommentsUpdated} commentaires Wrike mis à jour.`);

    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour des commentaires Wrike :", error.message);
    }
};




module.exports = { fetchAndStoreAllWrikeComments, updateRecentWrikeComments, createWrikeCommentsTable };

// Commentaires liés à des tâches
// SELECT 
//     c.Id AS Comment_Id,
//     c.AuthorId AS Comment_AuthorId,
//     c.Text AS Comment_Text,
//     c.UpdatedDate AS Comment_UpdatedDate,
//     c.CreatedDate AS Comment_CreatedDate,
    
//     c.TaskId AS Task_Id,
//     t.Title AS Task_Title,
//     t.Status AS Task_Status,
//     t.CreatedDate AS Task_CreatedDate,
//     t.UpdatedDate AS Task_UpdatedDate

// FROM wrike_comments c
// LEFT JOIN wrike_tasks t 
//     ON c.TaskId = t.Id
// WHERE c.TaskId IS NOT NULL;

// Commentaires liés à des projets actifs
// SELECT 
//     c.Id AS Comment_Id,
//     c.AuthorId AS Comment_AuthorId,
//     c.Text AS Comment_Text,
//     c.UpdatedDate AS Comment_UpdatedDate,
//     c.CreatedDate AS Comment_CreatedDate,
    
//     c.FolderId_Active AS Project_Id,
//     pa.Title AS Project_Title,
//     pa.CreatedDate AS Project_CreatedDate,
//     pa.UpdatedDate AS Project_UpdatedDate

// FROM wrike_comments c
// LEFT JOIN wrike_projects_active pa 
//     ON c.FolderId_Active = pa.Id
// WHERE c.FolderId_Active IS NOT NULL;

// Commentaires liés à des projets annulés
// SELECT 
//     c.Id AS Comment_Id,
//     c.AuthorId AS Comment_AuthorId,
//     c.Text AS Comment_Text,
//     c.UpdatedDate AS Comment_UpdatedDate,
//     c.CreatedDate AS Comment_CreatedDate,
    
//     c.FolderId_Annules AS Project_Id,
//     pn.Title AS Project_Title,
//     pn.CreatedDate AS Project_CreatedDate,
//     pn.UpdatedDate AS Project_UpdatedDate

// FROM wrike_comments c
// LEFT JOIN wrike_projects_annules pn 
//     ON c.FolderId_Annules = pn.Id
// WHERE c.FolderId_Annules IS NOT NULL;

// Commentaires liés à des projets terminés
// SELECT 
//     c.Id AS Comment_Id,
//     c.AuthorId AS Comment_AuthorId,
//     c.Text AS Comment_Text,
//     c.UpdatedDate AS Comment_UpdatedDate,
//     c.CreatedDate AS Comment_CreatedDate,
    
//     c.FolderId_Termines AS Project_Id,
//     pt.Title AS Project_Title,
//     pt.CreatedDate AS Project_CreatedDate,
//     pt.UpdatedDate AS Project_UpdatedDate

// FROM wrike_comments c
// LEFT JOIN wrike_projects_termines pt 
//     ON c.FolderId_Termines = pt.Id
// WHERE c.FolderId_Termines IS NOT NULL;
