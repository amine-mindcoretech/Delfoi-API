// controllers/delfoiController.js
const axios = require('axios');
const db = require('../config/db');

const formatDateForMySQL = (isoDate) => {
    if (!isoDate) return null;
    return new Date(isoDate).toISOString().slice(0, 19).replace('T', ' ');
};

const getValueOrNull = (value) => (value !== undefined && value !== null ? value : null);

exports.fetchAndStoreDelfoiData = async () => {
    try {
        const username = process.env.DELFOI_USER;
        const password = process.env.DELFOI_PASS;
        
        const headers = {
            'Content-Type': 'application/json'
        };

        let start = 0;
        const limit = 100;
        let totalRecords = null;

        console.log("🔍 Début de la récupération des données depuis l'API Delfoi...");

        // Étape 1 : Réinitialiser existe_dans_delfoi à 0 pour tous les enregistrements
        await db.execute('UPDATE delfoi_operations SET existe_dans_delfoi = 0');
        console.log("🔄 Colonne existe_dans_delfoi réinitialisée à 0 pour tous les enregistrements.");

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
                totalRecords = response.data.total;
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

                // Étape 2 : Insérer ou mettre à jour avec existe_dans_delfoi = 1
                await db.execute(
                    `INSERT INTO delfoi_operations (
                        InternalID, Finished, FinishedTime, Notes, ProcessAmount, ProcessName, Scheduled, 
                        ScheduledStartTime, ScheduledFinishTime, SchedulingChangedAt, Status, UniqueIdentifier, 
                        Started, StartedTime, ResourceCode, ResourceGroupCode, ResourceGroupName, ResourceName, 
                        ScheduledCycleTime_Amount, ScheduledCycleTime_Unit, ScheduledManTime_Amount, ScheduledManTime_Unit, 
                        ScheduledSetupTime_Amount, ScheduledSetupTime_Unit, ScheduledWorkload_Amount, ScheduledWorkload_Unit, 
                        SignedMachineTime_Amount, SignedMachineTime_Unit, SignedQuantity, Order_ArticleCode, Order_ArticleName, 
                        Order_OrderNumber, Order_RequiredDate, Order_CustomStrings_1, Order_CustomStrings_2, Order_CustomStrings_3,
                        existe_dans_delfoi
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
                        Order_CustomStrings_3 = VALUES(Order_CustomStrings_3),
                        existe_dans_delfoi = 1`,
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

            start += limit;

        } while (start < totalRecords);

        console.log("✅ Récupération et stockage des données terminés !");
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des données :", error);
    }
};