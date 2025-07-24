const axios = require('axios');
const qs = require('qs');
const db = require('../config/db');
require('dotenv').config();

let ACCESS_TOKEN = null;
let tokenExpiry = null;
const LIST_ID = process.env.SHAREPOINT_LIST_ID;
const SITE_ID = process.env.SHAREPOINT_SITE_ID;

const getAccessToken = async () => {
    const now = new Date();
    if (ACCESS_TOKEN && tokenExpiry && now < tokenExpiry) return ACCESS_TOKEN;

    const tokenUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;
    const payload = {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
    };

    try {
        const response = await axios.post(tokenUrl, qs.stringify(payload), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        ACCESS_TOKEN = response.data.access_token;
        tokenExpiry = new Date(now.getTime() + response.data.expires_in * 1000);
        console.log("✅ Nouveau token Graph généré.");
        return ACCESS_TOKEN;
    } catch (error) {
        console.error("❌ Erreur lors de la génération du token:", error.response?.data || error.message);
        throw error;
    }
};

const mapSharePointTypeToSQL = (column) => {
    if (column.text) return 'TEXT';
    if (column.number) return 'DECIMAL(15,10)';
    if (column.boolean) return 'BOOLEAN';
    if (column.dateTime) return 'DATETIME';
    if (column.calculated) {
        if (column.calculated.outputType === 'number') return 'DECIMAL(15,10)';
        if (column.calculated.outputType === 'currency') return 'DECIMAL(15,10)';
        if (column.calculated.outputType === 'dateTime') return 'DATETIME';
        return 'TEXT';
    }
    if (column.personOrGroup) return 'TEXT';
    if (column.lookup) return 'TEXT';
    return 'TEXT'; // Default
};

const sanitizeFieldName = (name, isDisplayName = true) => {
    if (isDisplayName) {
        return name;
    }
    return name
        .replace(/^@/, '')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .replace(/^_/, '')
        .replace(/_$/, '');
};

const parseDateToMySQLFormat = (value) => {
    // Handle null or undefined values
    if (value === null || value === undefined) return null;

    // Handle ISO 8601 format (e.g., 2025-06-20T00:00:00Z)
    if (isValidISODate(value)) {
        return value.replace('T', ' ').replace('Z', '');
    }

    // Handle DD/MM/YYYY format (e.g., 20/6/2025 or 20/06/2025)
    const localizedDatePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = value.match(localizedDatePattern);
    if (match) {
        const [_, day, month, year] = match;
        // Validate month and day
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);
        if (monthNum < 1 || monthNum > 12) {
            console.warn(`⚠️ Invalid month in date: ${value} (month: ${monthNum})`);
            return null;
        }
        if (dayNum < 1 || dayNum > 31) {
            console.warn(`⚠️ Invalid day in date: ${value} (day: ${dayNum})`);
            return null;
        }
        // Validate days for specific months
        if ((monthNum === 4 || monthNum === 6 || monthNum === 9 || monthNum === 11) && dayNum > 30) {
            console.warn(`⚠️ Invalid day for month ${monthNum} in date: ${value}`);
            return null;
        }
        if (monthNum === 2) {
            const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
            if (dayNum > (isLeapYear ? 29 : 28)) {
                console.warn(`⚠️ Invalid day for February in date: ${value}`);
                return null;
            }
        }
        // Pad month and day with leading zeros
        const paddedMonth = month.padStart(2, '0');
        const paddedDay = day.padStart(2, '0');
        // Return in MySQL DATETIME format
        const formattedDate = `${year}-${paddedMonth}-${paddedDay} 00:00:00`;
        console.debug(`✅ Parsed date: ${value} -> ${formattedDate}`);
        return formattedDate;
    }

    // Log unrecognized date formats
    console.warn(`⚠️ Unrecognized date format: ${value}`);
    return null;
};

const fetchColumnDefinitions = async () => {
    const token = await getAccessToken();
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/columns`;
    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            }
        });
        return response.data.value;
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des colonnes:", error.response?.data || error.message);
        throw error;
    }
};

const dropTable = async () => {
    const sql = `DROP TABLE IF EXISTS sharepoint_Tbl_CaptureInventaire`;
    try {
        await db.execute(sql);
        console.log("✅ Table sharepoint_Tbl_CaptureInventaire supprimée.");
    } catch (error) {
        console.error("❌ Erreur lors de la suppression de la table:", error.message);
        throw error;
    }
};

const createTable = async (columns) => {
    let columnDefinitions = [`id INT PRIMARY KEY`];
    const usedNames = new Set();
    const nameToDisplayName = new Map();
    const decimalColumns = new Set();
    const datetimeColumns = new Set();

    for (const column of columns) {
        if (column.name === 'ID') continue;
        let cleanField = sanitizeFieldName(column.displayName, true);
        let uniqueField = cleanField;
        if (usedNames.has(cleanField.toLowerCase())) {
            const nameBasedSuffix = sanitizeFieldName(column.name, false);
            uniqueField = `${cleanField}_${nameBasedSuffix}`;
        }
        usedNames.add(uniqueField.toLowerCase());
        nameToDisplayName.set(column.name, uniqueField);
        const sqlType = mapSharePointTypeToSQL(column);
        columnDefinitions.push(`\`${uniqueField}\` ${sqlType}`);
        if (sqlType === 'DECIMAL(15,10)') {
            decimalColumns.add(uniqueField);
        }
        if (sqlType === 'DATETIME') {
            datetimeColumns.add(uniqueField);
        }
    }

    const sql = `CREATE TABLE sharepoint_Tbl_CaptureInventaire (
        ${columnDefinitions.join(',\n        ')}
    )`;

    try {
        await db.execute(sql);
        console.log("✅ Table sharepoint_Tbl_CaptureInventaire créée avec succès.");
    } catch (error) {
        console.error("❌ Erreur lors de la création de la table:", error.message);
        throw error;
    }

    return { nameToDisplayName, decimalColumns, datetimeColumns };
};

const insertOrUpdateItems = async (items, { nameToDisplayName, decimalColumns, datetimeColumns }) => {
    const validColumns = Array.from(nameToDisplayName.keys());

    for (const item of items) {
        const fields = item.fields || {};
        const cleanFields = {};
        const values = [];

        for (const [key, val] of Object.entries(fields)) {
            if (!validColumns.includes(key) || key === 'id') continue;
            const cleanKey = nameToDisplayName.get(key);
            if (!cleanKey) {
                console.warn(`⚠️ Clé ${key} non trouvée dans nameToDisplayName`);
                continue;
            }

            let value = val;
            if (typeof val === 'object' && val !== null) {
                if (val.displayName) value = val.displayName;
                else if (val.lookupValue) value = val.lookupValue;
                else value = JSON.stringify(val);
            } else if (typeof val === 'boolean') {
                value = val ? 1 : 0;
            } else if (datetimeColumns.has(cleanKey) && typeof val === 'string') {
                // Debug logging for DateCapture
                if (cleanKey === 'DateCapture') {
                    console.debug(`Raw DateCapture for item ${item.id}: ${val}`);
                }
                value = parseDateToMySQLFormat(val);
                if (cleanKey === 'DateCapture') {
                    console.debug(`Parsed DateCapture for item ${item.id}: ${value}`);
                }
            } else if (val === null || val === undefined) {
                value = null;
            } else if (decimalColumns.has(cleanKey) && typeof val === 'string') {
                value = val.replace(/[^0-9.-]/g, '');
                const numericValue = parseFloat(value);
                value = isNaN(numericValue) ? null : numericValue.toFixed(2);
            }

            cleanFields[cleanKey] = value;
            values.push(value);
        }

        const columns = Object.keys(cleanFields);
        if (columns.length === 0) {
            console.log(`⚠️ Aucun champ valide pour l'item ${item.id}`);
            continue;
        }

        const sql = `INSERT INTO sharepoint_Tbl_CaptureInventaire (\`id\`, ${columns.map(col => `\`${col}\``).join(', ')})
                    VALUES (?, ${columns.map(() => '?').join(', ')})
                    ON DUPLICATE KEY UPDATE ${columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ')}`;

        try {
            await db.execute(sql, [item.id, ...values]);
            //console.log(`✅ Item ${item.id} inséré/mis à jour avec succès.`);
        } catch (error) {
            console.error(`❌ Erreur lors de l'insertion/mise à jour de l'item ${item.id}:`, error.message);
            throw error;
        }
    }
};

const isValidISODate = (val) => {
    return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z)?$/.test(val);
};

const fetchSharePointItems = async (url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items?expand=fields`) => {
    try {
        const token = await getAccessToken();
        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        };

        const columns = await fetchColumnDefinitions();
        await dropTable();
        const { nameToDisplayName, decimalColumns, datetimeColumns } = await createTable(columns);
        const response = await axios.get(url, { headers });
        const items = response.data.value;

        if (!items || items.length === 0) {
            console.log("⚠️ Aucun item trouvé dans la liste SharePoint.");
            return;
        }

        await insertOrUpdateItems(items, { nameToDisplayName, decimalColumns, datetimeColumns });

        if (response.data['@odata.nextLink']) {
            await fetchSharePointItems(response.data['@odata.nextLink']);
        }

        console.log("✅ Synchronisation des items terminée.");
    } catch (error) {
        console.error("❌ Erreur SharePoint API:", error.response?.data || error.message);
        throw error;
    }
};

const fetchRecentUpdatedItems = async () => {
    try {
        const token = await getAccessToken();
        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        };

        const columns = await fetchColumnDefinitions();
        const nameToDisplayName = new Map();
        const decimalColumns = new Set();
        const datetimeColumns = new Set();
        const usedNames = new Set();

        for (const column of columns) {
            if (column.name === 'ID') continue;
            let cleanField = sanitizeFieldName(column.displayName, true);
            let uniqueField = cleanField;
            if (usedNames.has(cleanField.toLowerCase())) {
                const nameBasedSuffix = sanitizeFieldName(column.name, false);
                uniqueField = `${cleanField}_${nameBasedSuffix}`;
            }
            usedNames.add(uniqueField.toLowerCase());
            nameToDisplayName.set(column.name, uniqueField);
            const sqlType = mapSharePointTypeToSQL(column);
            if (sqlType === 'DECIMAL(15,10)') {
                decimalColumns.add(uniqueField);
            }
            if (sqlType === 'DATETIME') {
                datetimeColumns.add(uniqueField);
            }
        }

        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

        const fetchPage = async (url, collected = []) => {
            const response = await axios.get(url, { headers });
            const items = response.data.value || [];
            const recentItems = items.filter(item => {
                const modified = new Date(item.lastModifiedDateTime);
                return modified >= threeDaysAgo;
            });
            const combined = collected.concat(recentItems);
            if (response.data['@odata.nextLink']) {
                return await fetchPage(response.data['@odata.nextLink'], combined);
            } else {
                return combined;
            }
        };

        const initialUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items?expand=fields`;
        const filteredItems = await fetchPage(initialUrl);

        if (filteredItems.length > 0) {
            await insertOrUpdateItems(filteredItems, { nameToDisplayName, decimalColumns, datetimeColumns });
            console.log(`✅ ${filteredItems.length} items récents mis à jour.`);
        } else {
            console.log("⚠️ Aucun item modifié dans les 3 derniers jours.");
        }
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation des items récents:", error.message);
        throw error;
    }
};

module.exports = { fetchSharePointItems, fetchRecentUpdatedItems };