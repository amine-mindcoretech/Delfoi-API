// controllers/delfoiController.js
const axios = require('axios');
const db = require('../config/db');

const formatDateForMySQL = (isoDate) => {
    if (!isoDate) return null;  // Retourne NULL si la date est vide
    return new Date(isoDate).toISOString().slice(0, 19).replace('T', ' ');
};

const getValueOrNull = (value) => (value !== undefined && value !== null ? value : null);


// exports.fetchAndStoreDelfoiData = async (req, res) => {
//     try {
//         const username = process.env.DELFOI_USER;
//         const password = process.env.DELFOI_PASS;
        
//         const headers = {
//             'Content-Type': 'application/json'
//         };
        
//         let start = 0;
//         const limit = 25;
//         let totalRecords = null;

//         do {
            // const response = await axios.post('https://plan.delfoi.com/MindCore/rest/operation/search', {
            //     limit,
            //     start
            // }, {
//                 headers,
//                 auth: {
//                     username,
//                     password
//                 }
//             });
            
//             console.log("Résultat de l'API Delfoi :", JSON.stringify(response.data, null, 2));

//             if (!totalRecords && response.data.total) {
//                 totalRecords = response.data.total;
//             }

//             if (response.data.operations) {
//                 for (const record of response.data.operations) {
//                     // Vérifier si record est défini
//                     if (!record || typeof record !== 'object') {
//                         console.warn("⚠️ Record invalide ou undefined, on ignore cette entrée.");
//                         continue;
//                     }

//                     // Vérifier si `status` existe
//                     if (!record.hasOwnProperty('status')) {
//                         console.warn(`⚠️ 'status' est manquant pour record ID: ${record.internalID || 'Inconnu'}, on ignore cette entrée.`);
//                         continue;
//                     }

//                     // Vérifier si `allocatedResource` existe, sinon le remplacer par un objet vide
//                     if (!record.hasOwnProperty('allocatedResource')) {
//                         console.warn(`⚠️ 'allocatedResource' est manquant pour record ID: ${record.internalID || 'Inconnu'}, valeur remplacée par NULL.`);
//                         record.allocatedResource = {};
//                     }

//                     // Vérifier si `order` existe, sinon le remplacer par un objet vide
//                     if (!record.hasOwnProperty('order')) {
//                         console.warn(`⚠️ 'order' est manquant pour record ID: ${record.internalID || 'Inconnu'}, valeur remplacée par NULL.`);
//                         record.order = {};
//                     }
                    // await db.execute(
                    //     `INSERT INTO delfoi_operations (
                    //         Finished, FinishedTime, InternalID, Notes, ProcessAmount, ProcessName, Scheduled, 
                    //         ScheduledStartTime, ScheduledFinishTime, SchedulingChangedAt, Status, UniqueIdentifier, 
                    //         Started, StartedTime, ResourceCode, ResourceGroupCode, ResourceGroupName, ResourceName, 
                    //         ScheduledCycleTime_Amount, ScheduledCycleTime_Unit, ScheduledManTime_Amount, ScheduledManTime_Unit, 
                    //         ScheduledSetupTime_Amount, ScheduledSetupTime_Unit, ScheduledWorkload_Amount, ScheduledWorkload_Unit, 
                    //         SignedMachineTime_Amount, SignedMachineTime_Unit, SignedQuantity, Order_ArticleCode, Order_ArticleName, 
                    //         Order_OrderNumber, Order_RequiredDate, Order_CustomStrings_1, Order_CustomStrings_2, Order_CustomStrings_3
                    //     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
                    //     ON DUPLICATE KEY UPDATE 
                    //         ProcessName = VALUES(ProcessName), Status = VALUES(Status), ScheduledStartTime = VALUES(ScheduledStartTime),
                    //         Finished = VALUES(Finished), FinishedTime = VALUES(FinishedTime), Notes = VALUES(Notes),
                    //         ProcessAmount = VALUES(ProcessAmount), Scheduled = VALUES(Scheduled), ScheduledFinishTime = VALUES(ScheduledFinishTime),
                    //         SchedulingChangedAt = VALUES(SchedulingChangedAt), UniqueIdentifier = VALUES(UniqueIdentifier), Started = VALUES(Started),
                    //         StartedTime = VALUES(StartedTime), ResourceCode = VALUES(ResourceCode), ResourceGroupCode = VALUES(ResourceGroupCode),
                    //         ResourceGroupName = VALUES(ResourceGroupName), ResourceName = VALUES(ResourceName), ScheduledCycleTime_Amount = VALUES(ScheduledCycleTime_Amount),
                    //         ScheduledCycleTime_Unit = VALUES(ScheduledCycleTime_Unit), ScheduledManTime_Amount = VALUES(ScheduledManTime_Amount),
                    //         ScheduledManTime_Unit = VALUES(ScheduledManTime_Unit), ScheduledSetupTime_Amount = VALUES(ScheduledSetupTime_Amount),
                    //         ScheduledSetupTime_Unit = VALUES(ScheduledSetupTime_Unit), ScheduledWorkload_Amount = VALUES(ScheduledWorkload_Amount),
                    //         ScheduledWorkload_Unit = VALUES(ScheduledWorkload_Unit), SignedMachineTime_Amount = VALUES(SignedMachineTime_Amount),
                    //         SignedMachineTime_Unit = VALUES(SignedMachineTime_Unit), SignedQuantity = VALUES(SignedQuantity),
                    //         Order_ArticleCode = VALUES(Order_ArticleCode), Order_ArticleName = VALUES(Order_ArticleName),
                    //         Order_OrderNumber = VALUES(Order_OrderNumber), Order_RequiredDate = VALUES(Order_RequiredDate),
                    //         Order_CustomStrings_1 = VALUES(Order_CustomStrings_1), Order_CustomStrings_2 = VALUES(Order_CustomStrings_2),
                    //         Order_CustomStrings_3 = VALUES(Order_CustomStrings_3)`,
                    //     [
                    //         getValueOrNull(record.finished),
                    //         formatDateForMySQL(record.finishedTime),
                    //         record.internalID, 
                    //         getValueOrNull(record.notes), 
                    //         getValueOrNull(record.processAmount),
                    //         getValueOrNull(record.processName), 
                    //         getValueOrNull(record.scheduled), 
                    //         formatDateForMySQL(record.scheduledStartTime), 
                    //         formatDateForMySQL(record.scheduledFinishTime),
                    //         formatDateForMySQL(record.schedulingChangedAt), 
                    //         getValueOrNull(record.status), 
                    //         getValueOrNull(record.uniqueIdentifier), 
                    //         getValueOrNull(record.started), 
                    //         formatDateForMySQL(record.startedTime),
                    //         // Gestion des valeurs nulles pour `allocatedResource`
                    //         getValueOrNull(record.allocatedResource?.resourceCode), 
                    //         getValueOrNull(record.allocatedResource?.resourceGroupCode),
                    //         getValueOrNull(record.allocatedResource?.resourceGroupName), 
                    //         getValueOrNull(record.allocatedResource?.resourceName),
                    //         getValueOrNull(record.scheduledCycleTime?.amount), 
                    //         getValueOrNull(record.scheduledCycleTime?.timeUnit),
                    //         getValueOrNull(record.scheduledManTime?.amount), 
                    //         getValueOrNull(record.scheduledManTime?.timeUnit),
                    //         getValueOrNull(record.scheduledSetupTime?.amount), 
                    //         getValueOrNull(record.scheduledSetupTime?.timeUnit),
                    //         getValueOrNull(record.scheduledWorkload?.amount), 
                    //         getValueOrNull(record.scheduledWorkload?.timeUnit),
                    //         getValueOrNull(record.signedMachineTime?.amount), 
                    //         getValueOrNull(record.signedMachineTime?.timeUnit), 
                    //         getValueOrNull(record.signedQuantity),
                    //         // Gestion des valeurs nulles pour `order`
                    //         getValueOrNull(record.order?.articleCode), 
                    //         getValueOrNull(record.order?.articleName), 
                    //         getValueOrNull(record.order?.orderNumber), 
                    //         formatDateForMySQL(getValueOrNull(record.order?.requiredDate)),
                    //         getValueOrNull(record.order?.customStrings?.[0]), 
                    //         getValueOrNull(record.order?.customStrings?.[1]), 
                    //         getValueOrNull(record.order?.customStrings?.[2])
                    //     ]
//                     );
//                 }
//             }
//             start += limit;
//         } while (start < totalRecords);
        
//         res.status(200).json({ message: 'Données Delfoi récupérées et stockées avec succès' });
//     } catch (error) {
//         console.error('Erreur lors de la récupération des données:', error);
//         res.status(500).json({ error: 'Erreur lors de la récupération des données' });
//     }
// };


// exports.fetchAndStoreDelfoiData = async () => {
//     try {
//         const username = process.env.DELFOI_USER;
//         const password = process.env.DELFOI_PASS;
        
//         const headers = {
//             'Content-Type': 'application/json'
//         };

//         // 🔹 Appel API sans paramètres `limit` et `start`
//         const response = await axios.post('https://plan.delfoi.com/MindCore/rest/operation/search', {}, {
//             headers,
//             auth: {
//                 username,
//                 password
//             }
//         });

//         console.log("Résultat de l'API Delfoi :", JSON.stringify(response.data, null, 2));

//         if (!response.data.operations || !Array.isArray(response.data.operations)) {
//             console.warn("⚠️ Aucune opération reçue depuis l'API, arrêt du traitement.");
//             return;
//         }

//         for (const record of response.data.operations) {
//             // Vérifier si record est défini
//             if (!record || typeof record !== 'object') {
//                 console.warn("⚠️ Record invalide ou undefined, on ignore cette entrée.");
//                 continue;
//             }

//             // Vérifier si `status` existe
//             if (!record.hasOwnProperty('status')) {
//                 console.warn(`⚠️ 'status' est manquant pour record ID: ${record.internalID || 'Inconnu'}, on ignore cette entrée.`);
//                 continue;
//             }

//             // Vérifier si `allocatedResource` existe, sinon le remplacer par un objet vide
//             if (!record.hasOwnProperty('allocatedResource')) {
//                 console.warn(`⚠️ 'allocatedResource' est manquant pour record ID: ${record.internalID || 'Inconnu'}, valeur remplacée par NULL.`);
//                 record.allocatedResource = {};
//             }

//             // Vérifier si `order` existe, sinon le remplacer par un objet vide
//             if (!record.hasOwnProperty('order')) {
//                 console.warn(`⚠️ 'order' est manquant pour record ID: ${record.internalID || 'Inconnu'}, valeur remplacée par NULL.`);
//                 record.order = {};
//             }

//             await db.execute(
//                 `INSERT INTO delfoi_operations (
//                     Finished, FinishedTime, InternalID, Notes, ProcessAmount, ProcessName, Scheduled, 
//                     ScheduledStartTime, ScheduledFinishTime, SchedulingChangedAt, Status, UniqueIdentifier, 
//                     Started, StartedTime, ResourceCode, ResourceGroupCode, ResourceGroupName, ResourceName, 
//                     ScheduledCycleTime_Amount, ScheduledCycleTime_Unit, ScheduledManTime_Amount, ScheduledManTime_Unit, 
//                     ScheduledSetupTime_Amount, ScheduledSetupTime_Unit, ScheduledWorkload_Amount, ScheduledWorkload_Unit, 
//                     SignedMachineTime_Amount, SignedMachineTime_Unit, SignedQuantity, Order_ArticleCode, Order_ArticleName, 
//                     Order_OrderNumber, Order_RequiredDate, Order_CustomStrings_1, Order_CustomStrings_2, Order_CustomStrings_3
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
//                 ON DUPLICATE KEY UPDATE 
//                     ProcessName = VALUES(ProcessName), Status = VALUES(Status), ScheduledStartTime = VALUES(ScheduledStartTime),
//                     Finished = VALUES(Finished), FinishedTime = VALUES(FinishedTime), Notes = VALUES(Notes),
//                     ProcessAmount = VALUES(ProcessAmount), Scheduled = VALUES(Scheduled), ScheduledFinishTime = VALUES(ScheduledFinishTime),
//                     SchedulingChangedAt = VALUES(SchedulingChangedAt), UniqueIdentifier = VALUES(UniqueIdentifier), Started = VALUES(Started),
//                     StartedTime = VALUES(StartedTime), ResourceCode = VALUES(ResourceCode), ResourceGroupCode = VALUES(ResourceGroupCode),
//                     ResourceGroupName = VALUES(ResourceGroupName), ResourceName = VALUES(ResourceName), ScheduledCycleTime_Amount = VALUES(ScheduledCycleTime_Amount),
//                     ScheduledCycleTime_Unit = VALUES(ScheduledCycleTime_Unit), ScheduledManTime_Amount = VALUES(ScheduledManTime_Amount),
//                     ScheduledManTime_Unit = VALUES(ScheduledManTime_Unit), ScheduledSetupTime_Amount = VALUES(ScheduledSetupTime_Amount),
//                     ScheduledSetupTime_Unit = VALUES(ScheduledSetupTime_Unit), ScheduledWorkload_Amount = VALUES(ScheduledWorkload_Amount),
//                     ScheduledWorkload_Unit = VALUES(ScheduledWorkload_Unit), SignedMachineTime_Amount = VALUES(SignedMachineTime_Amount),
//                     SignedMachineTime_Unit = VALUES(SignedMachineTime_Unit), SignedQuantity = VALUES(SignedQuantity),
//                     Order_ArticleCode = VALUES(Order_ArticleCode), Order_ArticleName = VALUES(Order_ArticleName),
//                     Order_OrderNumber = VALUES(Order_OrderNumber), Order_RequiredDate = VALUES(Order_RequiredDate),
//                     Order_CustomStrings_1 = VALUES(Order_CustomStrings_1), Order_CustomStrings_2 = VALUES(Order_CustomStrings_2),
//                     Order_CustomStrings_3 = VALUES(Order_CustomStrings_3)`,
//                 [
//                     getValueOrNull(record.finished),
//                     formatDateForMySQL(record.finishedTime),
//                     record.internalID, 
//                     getValueOrNull(record.notes), 
//                     getValueOrNull(record.processAmount),
//                     getValueOrNull(record.processName), 
//                     getValueOrNull(record.scheduled), 
//                     formatDateForMySQL(record.scheduledStartTime), 
//                     formatDateForMySQL(record.scheduledFinishTime),
//                     formatDateForMySQL(record.schedulingChangedAt), 
//                     getValueOrNull(record.status), 
//                     getValueOrNull(record.uniqueIdentifier), 
//                     getValueOrNull(record.started), 
//                     formatDateForMySQL(record.startedTime),
//                     // Gestion des valeurs nulles pour `allocatedResource`
//                     getValueOrNull(record.allocatedResource?.resourceCode), 
//                     getValueOrNull(record.allocatedResource?.resourceGroupCode),
//                     getValueOrNull(record.allocatedResource?.resourceGroupName), 
//                     getValueOrNull(record.allocatedResource?.resourceName),
//                     getValueOrNull(record.scheduledCycleTime?.amount), 
//                     getValueOrNull(record.scheduledCycleTime?.timeUnit),
//                     getValueOrNull(record.scheduledManTime?.amount), 
//                     getValueOrNull(record.scheduledManTime?.timeUnit),
//                     getValueOrNull(record.scheduledSetupTime?.amount), 
//                     getValueOrNull(record.scheduledSetupTime?.timeUnit),
//                     getValueOrNull(record.scheduledWorkload?.amount), 
//                     getValueOrNull(record.scheduledWorkload?.timeUnit),
//                     getValueOrNull(record.signedMachineTime?.amount), 
//                     getValueOrNull(record.signedMachineTime?.timeUnit), 
//                     getValueOrNull(record.signedQuantity),
//                     // Gestion des valeurs nulles pour `order`
//                     getValueOrNull(record.order?.articleCode), 
//                     getValueOrNull(record.order?.articleName), 
//                     getValueOrNull(record.order?.orderNumber), 
//                     formatDateForMySQL(getValueOrNull(record.order?.requiredDate)),
//                     getValueOrNull(record.order?.customStrings?.[0]), 
//                     getValueOrNull(record.order?.customStrings?.[1]), 
//                     getValueOrNull(record.order?.customStrings?.[2])
//                 ]
//             );
//         }

//         console.log("✅ Récupération et stockage des données terminés !");
//     } catch (error) {
//         console.error("❌ Erreur lors de la récupération des données :", error);
//     }
// };TRUNCATE TABLE delfoi_operations;
exports.fetchAndStoreDelfoiData = async () => {
    try {
        const username = process.env.DELFOI_USER;
        const password = process.env.DELFOI_PASS;
        
        const headers = {
            'Content-Type': 'application/json'
        };

        let start = 0; // Commencer à la première ligne
        const limit = 100; // Nombre max de lignes par requête
        let totalRecords = null; // Nombre total d'enregistrements

        console.log("🔍 Début de la récupération des données depuis l'API Delfoi...");

        do {
            const response = await axios.post('https://plan.delfoi.com/MindCore/rest/operation/search', {
                limit,
                start
            }, {
                headers,
                auth: {
                    username,
                    password
                }
            });

            console.log(`📦 Récupération des enregistrements ${start} à ${start + limit}...`);

            if (!response.data.operations || !Array.isArray(response.data.operations)) {
                console.warn("⚠️ Aucune opération reçue depuis l'API, arrêt du traitement.");
                break;
            }

            if (totalRecords === null) {
                totalRecords = response.data.total; // Nombre total d'enregistrements à récupérer
                console.log(`📊 Nombre total d'enregistrements à récupérer : ${totalRecords}`);
            }

            for (const record of response.data.operations) {
                if (!record || typeof record !== 'object') {
                    console.warn("⚠️ Record invalide ou undefined, on ignore cette entrée.");
                    continue;
                }

                if (!record.hasOwnProperty('internalID')) {
                    console.warn("⚠️ 'internalID' est manquant, on ignore cette entrée.");
                    continue;
                }

                record.allocatedResource = record.allocatedResource || {};
                record.order = record.order || {};

                await db.execute(
                    `INSERT INTO delfoi_operations (
                        InternalID, Finished, FinishedTime, Notes, ProcessAmount, ProcessName, Scheduled, 
                        ScheduledStartTime, ScheduledFinishTime, SchedulingChangedAt, Status, UniqueIdentifier, 
                        Started, StartedTime, ResourceCode, ResourceGroupCode, ResourceGroupName, ResourceName, 
                        ScheduledCycleTime_Amount, ScheduledCycleTime_Unit, ScheduledManTime_Amount, ScheduledManTime_Unit, 
                        ScheduledSetupTime_Amount, ScheduledSetupTime_Unit, ScheduledWorkload_Amount, ScheduledWorkload_Unit, 
                        SignedMachineTime_Amount, SignedMachineTime_Unit, SignedQuantity, Order_ArticleCode, Order_ArticleName, 
                        Order_OrderNumber, Order_RequiredDate, Order_CustomStrings_1, Order_CustomStrings_2, Order_CustomStrings_3
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        Finished = VALUES(Finished), FinishedTime = VALUES(FinishedTime), Notes = VALUES(Notes),
                        ProcessAmount = VALUES(ProcessAmount), ProcessName = VALUES(ProcessName), Scheduled = VALUES(Scheduled),
                        ScheduledStartTime = VALUES(ScheduledStartTime), ScheduledFinishTime = VALUES(ScheduledFinishTime),
                        SchedulingChangedAt = VALUES(SchedulingChangedAt), Status = VALUES(Status), UniqueIdentifier = VALUES(UniqueIdentifier),
                        Started = VALUES(Started), StartedTime = VALUES(StartedTime), ResourceCode = VALUES(ResourceCode),
                        ResourceGroupCode = VALUES(ResourceGroupCode), ResourceGroupName = VALUES(ResourceGroupName),
                        ResourceName = VALUES(ResourceName), ScheduledCycleTime_Amount = VALUES(ScheduledCycleTime_Amount),
                        ScheduledCycleTime_Unit = VALUES(ScheduledCycleTime_Unit), ScheduledManTime_Amount = VALUES(ScheduledManTime_Amount),
                        ScheduledManTime_Unit = VALUES(ScheduledManTime_Unit), ScheduledSetupTime_Amount = VALUES(ScheduledSetupTime_Amount),
                        ScheduledSetupTime_Unit = VALUES(ScheduledSetupTime_Unit), ScheduledWorkload_Amount = VALUES(ScheduledWorkload_Amount),
                        ScheduledWorkload_Unit = VALUES(ScheduledWorkload_Unit), SignedMachineTime_Amount = VALUES(SignedMachineTime_Amount),
                        SignedMachineTime_Unit = VALUES(SignedMachineTime_Unit), SignedQuantity = VALUES(SignedQuantity),
                        Order_ArticleCode = VALUES(Order_ArticleCode), Order_ArticleName = VALUES(Order_ArticleName),
                        Order_OrderNumber = VALUES(Order_OrderNumber), Order_RequiredDate = VALUES(Order_RequiredDate),
                        Order_CustomStrings_1 = VALUES(Order_CustomStrings_1), Order_CustomStrings_2 = VALUES(Order_CustomStrings_2),
                        Order_CustomStrings_3 = VALUES(Order_CustomStrings_3)`,
                    [
                        record.internalID, 
                        getValueOrNull(record.finished),
                        formatDateForMySQL(record.finishedTime),
                        getValueOrNull(record.notes), 
                        getValueOrNull(record.processAmount),
                        getValueOrNull(record.processName), 
                        getValueOrNull(record.scheduled), 
                        formatDateForMySQL(record.scheduledStartTime), 
                        formatDateForMySQL(record.scheduledFinishTime),
                        formatDateForMySQL(record.schedulingChangedAt), 
                        getValueOrNull(record.status), 
                        getValueOrNull(record.uniqueIdentifier), 
                        getValueOrNull(record.started), 
                        formatDateForMySQL(record.startedTime),
                        getValueOrNull(record.allocatedResource?.resourceCode), 
                        getValueOrNull(record.allocatedResource?.resourceGroupCode),
                        getValueOrNull(record.allocatedResource?.resourceGroupName), 
                        getValueOrNull(record.allocatedResource?.resourceName),
                        getValueOrNull(record.scheduledCycleTime?.amount), 
                        getValueOrNull(record.scheduledCycleTime?.timeUnit),
                        getValueOrNull(record.scheduledManTime?.amount), 
                        getValueOrNull(record.scheduledManTime?.timeUnit),
                        getValueOrNull(record.scheduledSetupTime?.amount), 
                        getValueOrNull(record.scheduledSetupTime?.timeUnit),
                        getValueOrNull(record.scheduledWorkload?.amount), 
                        getValueOrNull(record.scheduledWorkload?.timeUnit),
                        getValueOrNull(record.signedMachineTime?.amount), 
                        getValueOrNull(record.signedMachineTime?.timeUnit), 
                        getValueOrNull(record.signedQuantity),
                        getValueOrNull(record.order?.articleCode), 
                        getValueOrNull(record.order?.articleName), 
                        getValueOrNull(record.order?.orderNumber), 
                        formatDateForMySQL(getValueOrNull(record.order?.requiredDate)),
                        getValueOrNull(record.order?.customStrings?.[0]), 
                        getValueOrNull(record.order?.customStrings?.[1]), 
                        getValueOrNull(record.order?.customStrings?.[2])
                    ]
                );
            }

            start += limit; // Passer à la page suivante

        } while (start < totalRecords); // Continuer tant qu'il y a encore des données

        console.log("✅ Récupération et stockage des données terminés !");
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des données :", error);
    }
};
