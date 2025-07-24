// controllers/delfoiSignaturesController.js
const axios = require('axios');
const db = require('../config/db');
require('dotenv').config();

const formatDateForMySQL = (isoDate) => {
    if (!isoDate) return null;
    return new Date(isoDate).toISOString().slice(0, 19).replace('T', ' ');
};

const getValueOrNull = (value) => (value !== undefined && value !== null ? value : null);

exports.fetchAndStoreDelfoiSignatures = async () => {
    try {
        const username = process.env.DELFOI_USER;
        const password = process.env.DELFOI_PASS;
        const headers = { 'Content-Type': 'application/json' };

        console.log('📥 Début de la synchronisation des signatures Delfoi...');

        const response = await axios.post(
            'https://plan.delfoi.com/MindCore/rest/signature/search',
            {},
            {
                headers,
                auth: { username, password },
            }
        );

        const data = response.data;
        if (!Array.isArray(data) || data.length === 0) {
            console.warn('⚠️ Aucune signature trouvée.');
            return;
        }
//customStrings array, doneBy_active boolen, doneBy_customStrings array, doneBy_notes text, doneBy_personnelID, doneBy_restrictedCustomStrings array, doneBy_staffGroup
        for (const record of data) {
            if (!record.signatureInternalID) continue;

            const doneBy = record.doneBy || {};
            const operation = record.operation || {};
            const allocated = operation.allocatedResource || {};
            const order = operation.order || {};

            await db.execute(
                `INSERT INTO delfoi_signatures (
                    signatureInternalID, approvedAt, approvedBy, customStrings, endTime, externalId,
                    scrapAmount, scrapReasonCode, setup, signedAmount, signedAt, signedBy, startTime, timeType,
                    doneBy_active, doneBy_customStrings, doneBy_firstname, doneBy_lastname, doneBy_internalId,
                    doneBy_notes, doneBy_personnelID, doneBy_restrictedCustomStrings,
                    doneBy_staffGroup, doneBy_weeklyWorkingHours,
                    op_internalID, op_notes, op_finished, op_finishedTime, op_idTag, op_processAmount, op_processCode,
                    op_processName, op_projectProcess, op_rcScheduled, op_scheduled, op_scheduledFinishTime,
                    op_scheduledRcFinishTime, op_scheduledRcSetupEndTime, op_scheduledRcStartTime,
                    op_scheduledSetupEndTime, op_scheduledStartTime, op_schedulingChangedAt, op_customStrings,
                    op_cycleTime_amount, op_cycleTime_unit,
                    op_manTime_amount, op_manTime_unit,
                    op_setupTime_amount, op_setupTime_unit,
                    op_workload_amount, op_workload_unit,
                    op_signedMachineTime_amount, op_signedMachineTime_unit,
                    op_signedQuantity, op_split, op_splitFrom, op_splitIDTag, op_started, op_startedTime,
                    op_status, op_uniqueIdentifier,
                    order_articleCode, order_articleName, order_customBooleans, order_customStrings,
                    order_earliestStart, order_orderNumber, order_orderSize,
                    order_plannedStartDate, order_plannedFinishDate, order_rcStartDate, order_rcFinishDate,
                    order_requiredDate, order_signedAmount, order_signedFinishDate,
                    op_resourceCode, op_resourceGroupCode, op_resourceGroupName, op_resourceName,
                    op_resource_customStrings
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                ) ON DUPLICATE KEY UPDATE 
                    approvedAt = VALUES(approvedAt),
                    approvedBy = VALUES(approvedBy),
                    customStrings = VALUES(customStrings),
                    endTime = VALUES(endTime),
                    externalId = VALUES(externalId),
                    scrapAmount = VALUES(scrapAmount),
                    scrapReasonCode = VALUES(scrapReasonCode),
                    setup = VALUES(setup),
                    signedAmount = VALUES(signedAmount),
                    signedAt = VALUES(signedAt),
                    signedBy = VALUES(signedBy),
                    startTime = VALUES(startTime),
                    timeType = VALUES(timeType),
                    doneBy_active = VALUES(doneBy_active),
                    doneBy_customStrings = VALUES(doneBy_customStrings),
                    doneBy_firstname = VALUES(doneBy_firstname),
                    doneBy_lastname = VALUES(doneBy_lastname),
                    doneBy_internalId = VALUES(doneBy_internalId),
                    doneBy_notes = VALUES(doneBy_notes),
                    doneBy_personnelID = VALUES(doneBy_personnelID),
                    doneBy_restrictedCustomStrings = VALUES(doneBy_restrictedCustomStrings),
                    doneBy_staffGroup = VALUES(doneBy_staffGroup),
                    doneBy_weeklyWorkingHours = VALUES(doneBy_weeklyWorkingHours),
                    op_internalID = VALUES(op_internalID),
                    op_notes = VALUES(op_notes),
                    op_finished = VALUES(op_finished),
                    op_finishedTime = VALUES(op_finishedTime),
                    op_idTag = VALUES(op_idTag),
                    op_processAmount = VALUES(op_processAmount),
                    op_processCode = VALUES(op_processCode),
                    op_processName = VALUES(op_processName),
                    op_projectProcess = VALUES(op_projectProcess),
                    op_rcScheduled = VALUES(op_rcScheduled),
                    op_scheduled = VALUES(op_scheduled),
                    op_scheduledFinishTime = VALUES(op_scheduledFinishTime),
                    op_scheduledRcFinishTime = VALUES(op_scheduledRcFinishTime),
                    op_scheduledRcSetupEndTime = VALUES(op_scheduledRcSetupEndTime),
                    op_scheduledRcStartTime = VALUES(op_scheduledRcStartTime),
                    op_scheduledSetupEndTime = VALUES(op_scheduledSetupEndTime),
                    op_scheduledStartTime = VALUES(op_scheduledStartTime),
                    op_schedulingChangedAt = VALUES(op_schedulingChangedAt),
                    op_customStrings = VALUES(op_customStrings),
                    op_cycleTime_amount = VALUES(op_cycleTime_amount),
                    op_cycleTime_unit = VALUES(op_cycleTime_unit),
                    op_manTime_amount = VALUES(op_manTime_amount),
                    op_manTime_unit = VALUES(op_manTime_unit),
                    op_setupTime_amount = VALUES(op_setupTime_amount),
                    op_setupTime_unit = VALUES(op_setupTime_unit),
                    op_workload_amount = VALUES(op_workload_amount),
                    op_workload_unit = VALUES(op_workload_unit),
                    op_signedMachineTime_amount = VALUES(op_signedMachineTime_amount),
                    op_signedMachineTime_unit = VALUES(op_signedMachineTime_unit),
                    op_signedQuantity = VALUES(op_signedQuantity),
                    op_split = VALUES(op_split),
                    op_splitFrom = VALUES(op_splitFrom),
                    op_splitIDTag = VALUES(op_splitIDTag),
                    op_started = VALUES(op_started),
                    op_startedTime = VALUES(op_startedTime),
                    op_status = VALUES(op_status),
                    op_uniqueIdentifier = VALUES(op_uniqueIdentifier),
                    order_articleCode = VALUES(order_articleCode),
                    order_articleName = VALUES(order_articleName),
                    order_customBooleans = VALUES(order_customBooleans),
                    order_customStrings = VALUES(order_customStrings),
                    order_earliestStart = VALUES(order_earliestStart),
                    order_orderNumber = VALUES(order_orderNumber),
                    order_orderSize = VALUES(order_orderSize),
                    order_plannedStartDate = VALUES(order_plannedStartDate),
                    order_plannedFinishDate = VALUES(order_plannedFinishDate),
                    order_rcStartDate = VALUES(order_rcStartDate),
                    order_rcFinishDate = VALUES(order_rcFinishDate),
                    order_requiredDate = VALUES(order_requiredDate),
                    order_signedAmount = VALUES(order_signedAmount),
                    order_signedFinishDate = VALUES(order_signedFinishDate),
                    op_resourceCode = VALUES(op_resourceCode),
                    op_resourceGroupCode = VALUES(op_resourceGroupCode),
                    op_resourceGroupName = VALUES(op_resourceGroupName),
                    op_resourceName = VALUES(op_resourceName),
                    op_resource_customStrings = VALUES(op_resource_customStrings)
                `,
                [
                    // Ligne 1 (14 champs)
                    record.signatureInternalID,
                    formatDateForMySQL(record.approvedAt),
                    getValueOrNull(record.approvedBy),
                    JSON.stringify(record.customStrings || {}),
                    formatDateForMySQL(record.endTime),
                    getValueOrNull(record.externalId),
                    getValueOrNull(record.scrapAmount),
                    getValueOrNull(record.scrapReasonCode),
                    getValueOrNull(record.setup),
                    getValueOrNull(record.signedAmount),
                    formatDateForMySQL(record.signedAt),
                    getValueOrNull(record.signedBy),
                    formatDateForMySQL(record.startTime),
                    getValueOrNull(record.timeType),
                    
                    // Ligne 2 (11 champs - doneBy)
                    getValueOrNull(doneBy?.active),
                    JSON.stringify(doneBy?.customStrings || {}),
                    getValueOrNull(doneBy?.firstname),
                    getValueOrNull(doneBy?.lastname),
                    getValueOrNull(doneBy?.internalId),
                    getValueOrNull(doneBy?.notes),
                    getValueOrNull(doneBy?.personnelID),
                    JSON.stringify(doneBy?.restrictedCustomStrings || {}),
                    getValueOrNull(doneBy?.staffGroup),
                    getValueOrNull(doneBy?.weeklyWorkingHours),
                    
                    // Ligne 3 (39 champs - operation)
                    getValueOrNull(operation?.internalID),
                    getValueOrNull(operation?.notes),
                    getValueOrNull(operation?.finished),
                    formatDateForMySQL(operation?.finishedTime),
                    getValueOrNull(operation?.idTag),
                    getValueOrNull(operation?.processAmount),
                    getValueOrNull(operation?.processCode),
                    getValueOrNull(operation?.processName),
                    getValueOrNull(operation?.projectProcess),
                    getValueOrNull(operation?.rcScheduled),
                    getValueOrNull(operation?.scheduled),
                    formatDateForMySQL(operation?.scheduledFinishTime),
                    formatDateForMySQL(operation?.scheduledRcFinishTime),
                    formatDateForMySQL(operation?.scheduledRcSetupEndTime),
                    formatDateForMySQL(operation?.scheduledRcStartTime),
                    formatDateForMySQL(operation?.scheduledSetupEndTime),
                    formatDateForMySQL(operation?.scheduledStartTime),
                    formatDateForMySQL(operation?.schedulingChangedAt),
                    JSON.stringify(operation?.customStrings || {}),
                    getValueOrNull(operation?.scheduledCycleTime?.amount),
                    getValueOrNull(operation?.scheduledCycleTime?.timeUnit),
                    getValueOrNull(operation?.scheduledManTime?.amount),
                    getValueOrNull(operation?.scheduledManTime?.timeUnit),
                    getValueOrNull(operation?.scheduledSetupTime?.amount),
                    getValueOrNull(operation?.scheduledSetupTime?.timeUnit),
                    getValueOrNull(operation?.scheduledWorkload?.amount),
                    getValueOrNull(operation?.scheduledWorkload?.timeUnit),
                    getValueOrNull(operation?.signedMachineTime?.amount),
                    getValueOrNull(operation?.signedMachineTime?.timeUnit),
                    getValueOrNull(operation?.signedQuantity),
                    getValueOrNull(operation?.split),
                    getValueOrNull(operation?.splitFrom),
                    getValueOrNull(operation?.splitIDTag),
                    getValueOrNull(operation?.started),
                    formatDateForMySQL(operation?.startedTime),
                    getValueOrNull(operation?.status),
                    getValueOrNull(operation?.uniqueIdentifier),
                    
                    // Ligne 4 (16 champs - order et resource)
                    getValueOrNull(order?.articleCode),
                    getValueOrNull(order?.articleName),
                    JSON.stringify(order?.customBooleans || {}),
                    JSON.stringify(order?.customStrings || {}),
                    formatDateForMySQL(order?.earliestStart),
                    getValueOrNull(order?.orderNumber),
                    getValueOrNull(order?.orderSize),
                    formatDateForMySQL(order?.plannedStartDate),
                    formatDateForMySQL(order?.plannedFinishDate),
                    formatDateForMySQL(order?.rcStartDate),
                    formatDateForMySQL(order?.rcFinishDate),
                    formatDateForMySQL(order?.requiredDate),
                    getValueOrNull(order?.signedAmount),
                    formatDateForMySQL(order?.signedFinishDate),
                    getValueOrNull(allocated?.resourceCode),
                    getValueOrNull(allocated?.resourceGroupCode),
                    getValueOrNull(allocated?.resourceGroupName),
                    getValueOrNull(allocated?.resourceName),
                    JSON.stringify(allocated?.resource_customStrings || {})
                ]
            );
        }

        console.log('✅ Signatures Delfoi insérées/mises à jour avec succès.');
    } catch (err) {
        console.error('❌ Erreur durant la synchronisation des signatures :', err.message);
    }
};

// CREATE TABLE IF NOT EXISTS delfoi_signatures (
//     signatureInternalID INT PRIMARY KEY,
//     approvedAt DATETIME,
//     approvedBy VARCHAR(100),
//     customStrings JSON,
//     endTime DATETIME,
//     externalId VARCHAR(100),
//     scrapAmount DECIMAL(10,2),
//     scrapReasonCode VARCHAR(100),
//     setup BOOLEAN,
//     signedAmount DECIMAL(10,2),
//     signedAt DATETIME,
//     signedBy VARCHAR(100),
//     startTime DATETIME,
//     timeType VARCHAR(50),
//     -- doneBy
//     doneBy_active BOOLEAN,
//     doneBy_customStrings JSON,
//     doneBy_firstname VARCHAR(100),
//     doneBy_lastname VARCHAR(100),
//     doneBy_internalId INT,
//     doneBy_notes TEXT,
//     doneBy_personnelID VARCHAR(100),
//     doneBy_restrictedCustomStrings JSON,
//     doneBy_staffGroup VARCHAR(255),
//     doneBy_weeklyWorkingHours DECIMAL(10,2),
//     -- operation
//     op_internalID INT,
//     op_notes TEXT,
//     op_finished BOOLEAN,
//     op_finishedTime DATETIME,
//     op_idTag VARCHAR(100),
//     op_processAmount DECIMAL(10,2),
//     op_processCode VARCHAR(50),
//     op_processName VARCHAR(100),
//     op_projectProcess BOOLEAN,
//     op_rcScheduled BOOLEAN,
//     op_scheduled BOOLEAN,
//     op_scheduledFinishTime DATETIME,
//     op_scheduledRcFinishTime DATETIME,
//     op_scheduledRcSetupEndTime DATETIME,
//     op_scheduledRcStartTime DATETIME,
//     op_scheduledSetupEndTime DATETIME,
//     op_scheduledStartTime DATETIME,
//     op_schedulingChangedAt DATETIME,
//     op_customStrings JSON,
//     -- operation: scheduledCycleTime
//     op_cycleTime_amount DECIMAL(10,2),
//     op_cycleTime_unit VARCHAR(20),
//     -- operation: scheduledManTime
//     op_manTime_amount DECIMAL(10,2),
//     op_manTime_unit VARCHAR(20),
//     -- operation: scheduledSetupTime
//     op_setupTime_amount DECIMAL(10,2),
//     op_setupTime_unit VARCHAR(20),
//     -- operation: scheduledWorkload
//     op_workload_amount DECIMAL(10,2),
//     op_workload_unit VARCHAR(20),
//     -- operation: signedMachineTime
//     op_signedMachineTime_amount DECIMAL(10,2),
//     op_signedMachineTime_unit VARCHAR(20),
//     -- operation: signedQuantity
//     op_signedQuantity DECIMAL(10,2),
//     op_split BOOLEAN,
//     op_splitFrom VARCHAR(100),
//     op_splitIDTag VARCHAR(100),
//     op_started BOOLEAN,
//     op_startedTime DATETIME,
//     op_status VARCHAR(100),
//     op_uniqueIdentifier VARCHAR(100),
//     -- operation: order
//     order_articleCode VARCHAR(255),
//     order_articleName VARCHAR(255),
//     order_customBooleans JSON,
//     order_customStrings JSON,
//     order_earliestStart DATETIME,
//     order_orderNumber VARCHAR(100),
//     order_orderSize INT,
//     order_plannedStartDate DATETIME,
//     order_plannedFinishDate DATETIME,
//     order_rcStartDate DATETIME,
//     order_rcFinishDate DATETIME,
//     order_requiredDate DATETIME,
//     order_signedAmount DECIMAL(10,2),
//     order_signedFinishDate DATETIME,
//     -- operation: allocatedResource
//     op_resourceCode VARCHAR(100),
//     op_resourceGroupCode VARCHAR(100),
//     op_resourceGroupName VARCHAR(255),
//     op_resourceName VARCHAR(100),
//     op_resource_customStrings JSON
// );
