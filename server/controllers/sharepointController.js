// controllers/sharepointController.js
const axios = require('axios');
const qs = require('qs');
const db = require('../config/db');
require('dotenv').config();

let ACCESS_TOKEN = null;
let tokenExpiry = null;
const LIST_ID = process.env.SHAREPOINT_LIST_ID;
const SITE_ID = process.env.SHAREPOINT_SITE_ID; // ex: mindcoretech.sharepoint.com,siteCollectionId,siteId

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

const fieldMappings = {
    field_2: 'capturepar',
    field_4: 'entrepot',
    field_8: 'qte'
};


const sanitizeFieldName = (name) => {
    return name
        .toLowerCase()
        .replace(/^@/, '')             // retire @ au début
        .replace(/[^a-z0-9_]/gi, '_')  // remplace tous caractères non valides par _
        .replace(/_+$/, '');           // supprime les _ à la fin
};

const isValidISODate = (val) => {
    return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z)?$/.test(val);
};

const mapGraphFieldToSQL = (value) => {
    if (typeof value === 'boolean') return 'BOOLEAN';
    if (typeof value === 'number') return 'DECIMAL(15,2)';
    if (isValidISODate(value)) return 'DATETIME';
    return 'TEXT';
};

const createTableIfNotExists = async (fieldMap) => {
    let columns = [`id INT PRIMARY KEY`];
    for (const [field, value] of Object.entries(fieldMap)) {
        if (field === 'id') continue; // ⛔ ignorer l'ID pour éviter le doublon
        const cleanField = sanitizeFieldName(field);
        const type = mapGraphFieldToSQL(value);
        columns.push(`\`${cleanField}\` ${type}`);
    }
    const sql = `CREATE TABLE IF NOT EXISTS sharepoint_Tbl_CaptureInventaire (
        ${columns.join(',\n        ')}
    )`;
    await db.execute(sql);
};

const ensureColumnsExist = async (items) => {
    const [rows] = await db.execute("SHOW COLUMNS FROM sharepoint_Tbl_CaptureInventaire");
    const existing = rows.map(r => r.Field);

    const allFields = {};

    for (const item of items) {
        for (const [field, value] of Object.entries(item.fields || {})) {
            if (field === 'id') continue;
            const mappedField = fieldMappings[field] || field;
            const cleanField = sanitizeFieldName(mappedField);
            if (!existing.includes(cleanField)) {
                allFields[cleanField] = mapGraphFieldToSQL(value);
            }
        }
    }

    for (const [field, type] of Object.entries(allFields)) {
        await db.execute(`ALTER TABLE sharepoint_Tbl_CaptureInventaire ADD COLUMN \`${field}\` ${type}`);
        console.log(`✅ Colonne ajoutée : ${field} (${type})`);
    }
};


const insertOrUpdateItems = async (items) => {
    for (const item of items) {
        const fields = item.fields || {};
        const cleanFields = {};

        for (const [key, val] of Object.entries(fields)) {
            if (key === 'id') continue;

            const cleanKey = sanitizeFieldName(key);
            let value = val;

            // Convertir uniquement les vraies dates ISO
            if (isValidISODate(val)) {
                value = val.replace('T', ' ').replace('Z', '');
            }

            cleanFields[cleanKey] = value;
        }

        const columns = Object.keys(cleanFields);
        const values = Object.values(cleanFields);
        const placeholders = columns.map(() => '?').join(', ');

        const sql = `INSERT INTO sharepoint_Tbl_CaptureInventaire (id, ${columns.join(', ')})
                    VALUES (?, ${placeholders})
                    ON DUPLICATE KEY UPDATE ${columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ')}`;

        await db.execute(sql, [item.id, ...values]);
    }
};

const fetchSharePointItems = async (url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items?expand=fields`) => {
    try {
        const token = await getAccessToken();
        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
        };

        const response = await axios.get(url, { headers });
        const items = response.data.value;

        if (!items || items.length === 0) return;

        // Crée la table selon le premier item uniquement (clé primaire + structure de base)
        await createTableIfNotExists(items[0].fields);

        // 🔍 S’assure que tous les champs de tous les items existent en base
        await ensureColumnsExist(items);

        // ✅ Insertion ou mise à jour des données
        await insertOrUpdateItems(items);

        // Pagination
        if (response.data['@odata.nextLink']) {
            await fetchSharePointItems(response.data['@odata.nextLink']);
        }

    } catch (error) {
        console.error("❌ Erreur SharePoint API:", error.response?.data || error.message);
    }
};
const fetchRecentUpdatedItems = async () => {
    const token = await getAccessToken();
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
    };

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
        await createTableIfNotExists(filteredItems[0].fields);
        await ensureColumnsExist(filteredItems);
        await insertOrUpdateItems(filteredItems);
    } else {
        console.log("⚠️ Aucun item modifié dans les 3 derniers jours.");
    }
};
module.exports = { fetchSharePointItems, fetchRecentUpdatedItems };

