//// controllers/sharepointControllerTbl_InvItemsLocOri_ID.js
const axios = require('axios');
const qs = require('qs');
const db = require('../config/db');
const { connectODBC } = require('../config/odbcConfig');
const iconv = require('iconv-lite');
require('dotenv').config();

let ACCESS_TOKEN = null;
let tokenExpiry = null;
const LIST_ID_INV_ITEMS = process.env.SHAREPOINT_LIST_Tbl_InvItemsLocOri_ID;
const LIST_ID_ITEMS = process.env.SHAREPOINT_LIST_Tbl_Items;
const LIST_ID_LOC = process.env.SHAREPOINT_LIST_Tbl_Loc;
const SITE_ID = process.env.SHAREPOINT_SITE_ID;

// Generate Microsoft Graph API access token
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

// Field mappings
const fieldMappingsInvItems = {
    Title: 'Titre',
    field_1: 'Location',
    field_2: 'Item',
    field_3: 'description',
    field_4: 'qte',
    field_5: 'Prix_Der',
    field_6: 'DateIMPFromGenius',
    ItemID: 'ItemID',
    Family: 'Family',
    Unit: 'Unit',
    Specification1: 'Specification1'
};
const fieldMappingsItems = {
    Title: 'Title',
    field_1: 'item',
    field_2: 'Family',
    field_3: 'Description',
    field_4: 'Specification1',
    field_5: 'Prix_Der',
    field_6: 'Prix_Moyen',
    field_7: 'Unit',
    field_8: 'UnitDesc'
};
const fieldMappingsLoc = { // New mapping for Tbl_Loc
    Title: 'Code',
    field_1: 'Location',
    field_2: 'Des'
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

const createTableIfNotExists = async (fieldMap, tableName, fieldMappings) => {
    await db.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
    console.log(`✅ Table ${tableName} supprimée.`);

    let columns = [`id INT PRIMARY KEY AUTO_INCREMENT`];
    for (const [field, mappedField] of Object.entries(fieldMappings)) {
        if (field === 'id') continue;
        const type = mapGraphFieldToSQL(fieldMap[field] || '');
        columns.push(`\`${mappedField}\` ${type}`);
    }
    const sql = `CREATE TABLE \`${tableName}\` (
        ${columns.join(',\n        ')}
    )`;
    await db.execute(sql);
    console.log(`✅ Table ${tableName} recréée avec succès.`);
};

const ensureColumnsExist = async (items, tableName, fieldMappings) => {
    const [rows] = await db.execute(`SHOW COLUMNS FROM ${tableName}`);
    const existing = rows.map(r => r.Field);
    const allFields = {};

    for (const item of items) {
        for (const [field, value] of Object.entries(item.fields || {})) {
            if (field === 'id') continue;
            const mappedField = fieldMappings[field] || field;
            if (!existing.includes(mappedField)) {
                allFields[mappedField] = mapGraphFieldToSQL(value);
            }
        }
    }

    for (const [field, type] of Object.entries(allFields)) {
        await db.execute(`ALTER TABLE ${tableName} ADD COLUMN \`${field}\` ${type}`);
        console.log(`✅ Colonne ajoutée : ${field} (${type})`);
    }
};

const insertOrUpdateItems = async (items, tableName, fieldMappings, useSharePointId = true) => {
    for (const item of items) {
        const fields = item.fields || {};
        const cleanFields = {};

        for (const [key, val] of Object.entries(fields)) {
            if (key === 'id') continue;
            const mappedKey = fieldMappings[key] || key;
            let value = val;
            if (isValidISODate(val)) {
                value = val.replace('T', ' ').replace('Z', '');
            }
            cleanFields[mappedKey] = value;
        }

        const columns = Object.keys(cleanFields);
        const values = Object.values(cleanFields);
        const placeholders = columns.map(() => '?').join(', ');

        const sql = useSharePointId
            ? `INSERT INTO ${tableName} (id, ${columns.map(col => `\`${col}\``).join(', ')})
               VALUES (?, ${placeholders})
               ON DUPLICATE KEY UPDATE ${columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ')}`
            : `INSERT INTO ${tableName} (${columns.map(col => `\`${col}\``).join(', ')})
               VALUES (${placeholders})
               ON DUPLICATE KEY UPDATE ${columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ')}`;

        await db.execute(sql, useSharePointId ? [item.id, ...values] : values);
    }
};

const formatDuration = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} minute(s) et ${remainingSeconds} seconde(s)`;
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const MAX_RETRIES = 10;
const INITIAL_DELAY_MS = 5000;
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000;

// SharePoint and Genius Sync Functions
const syncSharePointData = async () => {
    const tableName = 'sharepoint_Tbl_InvItemsLocOri';
    try {
        const token = await getAccessToken();
        const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
        let items = [];
        let url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID_INV_ITEMS}/items?expand=fields`;

        while (url) {
            const response = await axios.get(url, { headers });
            items = items.concat(response.data.value);
            url = response.data['@odata.nextLink'];
        }

        if (items.length > 0) {
            await createTableIfNotExists(items[0].fields, tableName, fieldMappingsInvItems);
            await ensureColumnsExist(items, tableName, fieldMappingsInvItems);
            await insertOrUpdateItems(items, tableName, fieldMappingsInvItems, true);
            console.log(`✅ ${items.length} items SharePoint stockés dans ${tableName}.`);
        } else {
            console.log("⚠️ Aucun item trouvé dans SharePoint (Tbl_InvItemsLocOri).");
        }
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation SharePoint (Tbl_InvItemsLocOri):", error.message);
        throw error;
    }
};

const syncSharePointItemsData = async () => {
    const tableName = 'sharepoint_Tbl_Items';
    try {
        const token = await getAccessToken();
        const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
        let items = [];
        let url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID_ITEMS}/items?expand=fields`;

        while (url) {
            const response = await axios.get(url, { headers });
            items = items.concat(response.data.value);
            url = response.data['@odata.nextLink'];
        }

        if (items.length > 0) {
            await createTableIfNotExists(items[0].fields, tableName, fieldMappingsItems);
            await ensureColumnsExist(items, tableName, fieldMappingsItems);
            await insertOrUpdateItems(items, tableName, fieldMappingsItems, true);
            console.log(`✅ ${items.length} items SharePoint stockés dans ${tableName}.`);
        } else {
            console.log("⚠️ Aucun item trouvé dans SharePoint (Tbl_Items).");
        }
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation SharePoint (Tbl_Items):", error.message);
        throw error;
    }
};

const syncGeniusData = async (sendUpdate = () => {}) => {
    const tableName = 'genius_Tbl_InvItemsLocOri';
    try {
        const connection = await connectODBC();
        const sql = `
            SELECT
                loca.Code,
                loca.Location,
                itm.Item,
                itm.ItemID,
                itm.Family,
                UPPER(itm.Unit) as 'Unit',
                itm.description1,
                itm.Specification1,
                SUM(invtc.IVY_QuantityLeft) as qte,
                inv.Prix_Der,
                CURRENT_TIMESTAMP as 'DateIMPFromGenius'
            FROM tcInventory invtc
            LEFT JOIN vgMfiItems itm ON invtc.IVY_ItemID=itm.ItemID
            LEFT JOIN Localisations loca ON invtc.IVY_LocationID=loca.LCN_LocationID
            LEFT JOIN inv ON inv.ItemID=invtc.IVY_ItemID
            WHERE 
                loca.Des3 = ''
            GROUP BY loca.Code, loca.Location, itm.Item, itm.ItemID, itm.Family, itm.Unit, itm.description1, itm.Specification1, inv.Prix_Der
        `;
        const result = await connection.query(sql);
        await connection.close();

        const geniusData = result.map(row => {
            const decodeWith = (encoding) => {
                const decoded = {
                    Code: typeof row.Code === 'string' ? iconv.decode(Buffer.from(row.Code, 'binary'), encoding) : row.Code,
                    Location: typeof row.Location === 'string' ? iconv.decode(Buffer.from(row.Location, 'binary'), encoding) : row.Location,
                    Item: typeof row.Item === 'string' ? iconv.decode(Buffer.from(row.Item, 'binary'), encoding) : row.Item,
                    ItemID: typeof row.ItemID === 'string' ? iconv.decode(Buffer.from(row.ItemID, 'binary'), encoding) : row.ItemID,
                    Family: typeof row.Family === 'string' ? iconv.decode(Buffer.from(row.Family, 'binary'), encoding) : row.Family,
                    Unit: typeof row.Unit === 'string' ? iconv.decode(Buffer.from(row.Unit, 'binary'), encoding) : row.Unit,
                    description1: typeof row.description1 === 'string' ? iconv.decode(Buffer.from(row.description1, 'binary'), encoding) : row.description1,
                    Specification1: typeof row.Specification1 === 'string' ? iconv.decode(Buffer.from(row.Specification1, 'binary'), encoding) : row.Specification1
                };
                if (typeof decoded.description1 === 'string') {
                    decoded.description1 = decoded.description1
                        .replace(/\²/g, 'É')
                        .replace(/\¹/g, 'È')
                        .replace(/\³/g, 'À');
                }
                return decoded;
            };

            const cp850Decoded = decodeWith('cp850');
            return {
                Code: cp850Decoded.Code,
                Location: cp850Decoded.Location,
                Item: cp850Decoded.Item,
                ItemID: cp850Decoded.ItemID,
                Family: cp850Decoded.Family,
                Unit: cp850Decoded.Unit,
                description1: cp850Decoded.description1,
                Specification1: cp850Decoded.Specification1,
                qte: row.qte,
                Prix_Der: row.Prix_Der,
                DateIMPFromGenius: row.DateIMPFromGenius
            };
        });

        if (geniusData.length > 0) {
            await db.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
            const columns = [
                'id INT PRIMARY KEY AUTO_INCREMENT',
                '`Titre` TEXT',
                '`Location` TEXT',
                '`Item` TEXT',
                '`ItemID` TEXT',
                '`Family` TEXT',
                '`Unit` TEXT',
                '`description` TEXT',
                '`Specification1` TEXT',
                '`qte` DECIMAL(15,2)',
                '`Prix_Der` DECIMAL(15,2)',
                '`DateIMPFromGenius` DATETIME'
            ];
            const createSql = `CREATE TABLE \`${tableName}\` (
                ${columns.join(',\n        ')}
            )`;
            await db.execute(createSql);
            sendUpdate(`✅ Table ${tableName} supprimée et recréée avec succès.`);

            for (const item of geniusData) {
                const columns = ['Titre', 'Location', 'Item', 'ItemID', 'Family', 'Unit', 'description', 'Specification1', 'qte', 'Prix_Der', 'DateIMPFromGenius'];
                const values = [
                    item.Code,
                    item.Location,
                    item.Item,
                    item.ItemID,
                    item.Family,
                    item.Unit,
                    item.description1,
                    item.Specification1,
                    item.qte,
                    item.Prix_Der,
                    item.DateIMPFromGenius
                ];
                const sql = `INSERT INTO \`${tableName}\` (${columns.map(col => `\`${col}\``).join(', ')})
                            VALUES (${columns.map(() => '?').join(', ')})
                            ON DUPLICATE KEY UPDATE ${columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ')}`;
                await db.execute(sql, values);
            }
            sendUpdate(`✅ ${geniusData.length} items Genius stockés dans ${tableName}.`);
        } else {
            sendUpdate("⚠️ Aucune donnée trouvée dans Genius (genius_Tbl_InvItemsLocOri).");
        }
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation Genius (genius_Tbl_InvItemsLocOri):", error.message);
        throw error;
    }
};

const syncGeniusItemsData = async () => {
    const tableName = 'genius_Tbl_Items';
    try {
        const connection = await connectODBC();
        const sql = `
            SELECT
                itm.ItemID,
                itm.item,
                itm.Family,
                itm.Description1,
                itm.Specification1,
                inv.Prix_Der,
                itm.AvgCost as Prix_Moyen,
                UPPER(itm.Unit) as 'Unit',
                UPPER((SELECT Unite.Des3 FROM Unite WHERE Unite.code = itm.UnityLink)) as 'UnitDesc'
            FROM vgMfiItems itm
            LEFT JOIN inv ON itm.ItemID = inv.ItemID
            WHERE Active = 1 AND (OnHand + InProduction + OnOrder) > 0
        `;
        const result = await connection.query(sql);
        await connection.close();

        const geniusData = result.map(row => {
            const decodeWith = (encoding) => {
                const decoded = {
                    ItemID: typeof row.ItemID === 'string' ? iconv.decode(Buffer.from(row.ItemID, 'binary'), encoding) : row.ItemID,
                    item: typeof row.item === 'string' ? iconv.decode(Buffer.from(row.item, 'binary'), encoding) : row.item,
                    Family: typeof row.Family === 'string' ? iconv.decode(Buffer.from(row.Family, 'binary'), encoding) : row.Family,
                    Description1: typeof row.Description1 === 'string' ? iconv.decode(Buffer.from(row.Description1, 'binary'), encoding) : row.Description1,
                    Specification1: typeof row.Specification1 === 'string' ? iconv.decode(Buffer.from(row.Specification1, 'binary'), encoding) : row.Specification1,
                    Unit: typeof row.Unit === 'string' ? iconv.decode(Buffer.from(row.Unit, 'binary'), encoding) : row.Unit,
                    UnitDesc: typeof row.UnitDesc === 'string' ? iconv.decode(Buffer.from(row.UnitDesc, 'binary'), encoding) : row.UnitDesc
                };
                for (const key in decoded) {
                    if (typeof decoded[key] === 'string') {
                        decoded[key] = decoded[key]
                            .replace(/\²/g, 'É')
                            .replace(/\¹/g, 'È')
                            .replace(/\³/g, 'À');
                    }
                }
                return decoded;
            };

            const cp850Decoded = decodeWith('cp850');
            return {
                Title: cp850Decoded.ItemID,
                item: cp850Decoded.item,
                Family: cp850Decoded.Family,
                Description: cp850Decoded.Description1,
                Specification1: cp850Decoded.Specification1,
                Prix_Der: row.Prix_Der,
                Prix_Moyen: row.Prix_Moyen,
                Unit: cp850Decoded.Unit,
                UnitDesc: cp850Decoded.UnitDesc
            };
        });

        if (geniusData.length > 0) {
            await db.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
            const columns = [
                'id INT PRIMARY KEY AUTO_INCREMENT',
                '`Title` TEXT',
                '`item` TEXT',
                '`Family` TEXT',
                '`Description` TEXT',
                '`Specification1` TEXT',
                '`Prix_Der` DECIMAL(15,2)',
                '`Prix_Moyen` DECIMAL(15,2)',
                '`Unit` TEXT',
                '`UnitDesc` TEXT'
            ];
            const createSql = `CREATE TABLE \`${tableName}\` (
                ${columns.join(',\n        ')}
            )`;
            await db.execute(createSql);
            console.log(`✅ Table ${tableName} supprimée et recréée avec succès.`);

            for (const item of geniusData) {
                const columns = ['Title', 'item', 'Family', 'Description', 'Specification1', 'Prix_Der', 'Prix_Moyen', 'Unit', 'UnitDesc'];
                const values = [
                    item.Title,
                    item.item,
                    item.Family,
                    item.Description,
                    item.Specification1,
                    item.Prix_Der,
                    item.Prix_Moyen,
                    item.Unit,
                    item.UnitDesc
                ];
                const sql = `INSERT INTO \`${tableName}\` (${columns.map(col => `\`${col}\``).join(', ')})
                            VALUES (${columns.map(() => '?').join(', ')})
                            ON DUPLICATE KEY UPDATE ${columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ')}`;
                await db.execute(sql, values);
            }
            console.log(`✅ ${geniusData.length} items Genius stockés dans ${tableName}.`);
        } else {
            console.log("⚠️ Aucune donnée trouvée dans Genius (genius_Tbl_Items).");
        }
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation Genius (genius_Tbl_Items):", error.message);
        throw error;
    }
};

const addSharePointItem = async (itemData, listType = 'InvItems') => {
    const token = await getAccessToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const listId = listType === 'InvItems' ? LIST_ID_INV_ITEMS : LIST_ID_ITEMS;
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items`;

    let fields;
    if (listType === 'InvItems') {
        // Valider les longueurs des champs texte
        itemData.ItemID = itemData.ItemID?.length > 255 ? itemData.ItemID.substring(0, 255) : itemData.ItemID;
        itemData.Family = itemData.Family?.length > 255 ? itemData.Family.substring(0, 255) : itemData.Family;
        itemData.Unit = itemData.Unit?.length > 255 ? itemData.Unit.substring(0, 255) : itemData.Unit;
        itemData.Specification1 = itemData.Specification1?.length > 255 ? itemData.Specification1.substring(0, 255) : itemData.Specification1;

        fields = {
            Title: itemData.Titre,
            field_1: itemData.Location,
            field_2: itemData.Item,
            field_3: itemData.description,
            field_4: Number(itemData.qte),
            field_5: Number(itemData.Prix_Der),
            field_6: itemData.DateIMPFromGenius ? new Date(itemData.DateIMPFromGenius).toISOString() : new Date().toISOString(),
            ItemID: itemData.ItemID,
            Family: itemData.Family,
            Unit: itemData.Unit,
            Specification1: itemData.Specification1
        };
    } else {
        fields = {
            Title: itemData.Title,
            field_1: itemData.item,
            field_2: itemData.Family,
            field_3: itemData.Description,
            field_4: itemData.Specification1,
            field_5: Number(itemData.Prix_Der),
            field_6: Number(itemData.Prix_Moyen),
            field_7: itemData.Unit,
            field_8: itemData.UnitDesc
        };
    }

    try {
        const response = await axios.post(url, { fields }, { headers });
        console.log(`✅ Item inséré dans SharePoint (${listType}): ${fields.Title}`);
        return response.data;
    } catch (error) {
        console.error(`❌ Erreur lors de l'insertion de l'item (${listType}):`, error.response?.data || error.message);
        throw error;
    }
};

const replaceSharePointWithGeniusInvItems = async () => {
    const tableName = 'genius_Tbl_InvItemsLocOri';
    const listId = LIST_ID_INV_ITEMS;
    let deletionDuration = 0;
    let insertionDuration = 0;

    try {
        const token = await getAccessToken();
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        // Deletion Phase
        const deletionStart = Date.now();
        let items = [];
        let url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items?expand=fields`;
        while (url) {
            const response = await axios.get(url, { headers });
            items = items.concat(response.data.value);
            url = response.data['@odata.nextLink'];
        }

        if (items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                let attempt = 0;
                let success = false;

                while (attempt < MAX_RETRIES && !success) {
                    try {
                        await axios.delete(
                            `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${item.id}`,
                            { headers }
                        );
                        console.log(`✅ Item ${item.id} supprimé de SharePoint (InvItems).`);
                        success = true;
                    } catch (error) {
                        attempt++;
                        if (attempt === MAX_RETRIES) {
                            throw new Error(`Échec final de suppression de l'item ${item.id} après ${MAX_RETRIES} tentatives: ${error.message}`);
                        }
                        if (error.response?.status === 429 || error.response?.data?.error?.code === 'activityLimitReached') {
                            const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
                            console.log(`⚠️ Throttling détecté. Attente de ${delay}ms avant la tentative ${attempt + 1}/${MAX_RETRIES}...`);
                            await wait(delay);
                        } else {
                            throw error;
                        }
                    }
                }
                // Removed the delay here: if (i < items.length - 1) await wait(BATCH_DELAY_MS);
            }

            // Verify deletion
            let remainingItems = [];
            url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items?expand=fields`;
            while (url) {
                const response = await axios.get(url, { headers });
                remainingItems = remainingItems.concat(response.data.value);
                url = response.data['@odata.nextLink'];
            }
            if (remainingItems.length > 0) {
                throw new Error(`Échec de suppression complète: ${remainingItems.length} items restants. IDs restants: ${remainingItems.map(item => item.id).join(', ')}`);
            }
            console.log(`✅ Confirmation: Aucun item restant dans SharePoint (InvItems).`);
        } else {
            console.log(`⚠️ Aucun item à supprimer dans SharePoint (InvItems).`);
        }
        deletionDuration = Date.now() - deletionStart;
        console.log(`⏱️ Temps de suppression (InvItems): ${formatDuration(deletionDuration)}`);

        // Insertion Phase
        const insertionStart = Date.now();
        const [geniusData] = await db.execute(`SELECT * FROM ${tableName}`);
        if (geniusData.length === 0) {
            insertionDuration = Date.now() - insertionStart;
            return {
                message: `⚠️ Aucune donnée trouvée dans la table ${tableName}.`,
                deletionDuration,
                insertionDuration
            };
        }

        for (let i = 0; i < geniusData.length; i++) {
            const item = geniusData[i];
            let attempt = 0;
            let success = false;

            while (attempt < MAX_RETRIES && !success) {
                try {
                    const fields = {
                        Title: item.Titre,
                        field_1: item.Location,
                        field_2: item.Item,
                        field_3: item.description,
                        field_4: Number(item.qte),
                        field_5: Number(item.Prix_Der),
                        field_6: item.DateIMPFromGenuis ? new Date(item.DateIMPFromGenuis).toISOString() : new Date().toISOString()
                    };
                    await axios.post(
                        `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items`,
                        { fields },
                        { headers }
                    );
                    console.log(`✅ Item ${item.Titre} inséré dans SharePoint (InvItems).`);
                    success = true;
                } catch (error) {
                    attempt++;
                    if (attempt === MAX_RETRIES) {
                        throw new Error(`Échec final de l'insertion de l'item ${item.Titre} après ${MAX_RETRIES} tentatives: ${error.message}`);
                    }
                    if (error.response?.status === 429 || error.response?.data?.error?.code === 'activityLimitReached') {
                        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
                        console.log(`⚠️ Throttling détecté. Attente de ${delay}ms avant la tentative ${attempt + 1}/${MAX_RETRIES}...`);
                        await wait(delay);
                    } else {
                        throw error;
                    }
                }
            }
            // Removed the delay here: if (i < geniusData.length - 1) await wait(BATCH_DELAY_MS);
        }
        console.log(`✅ ${geniusData.length} items de ${tableName} insérés dans SharePoint (InvItems).`);
        insertionDuration = Date.now() - insertionStart;
        console.log(`⏱️ Temps d'insertion (InvItems): ${formatDuration(insertionDuration)}`);

        return {
            message: `✅ ${geniusData.length} items insérés avec succès`,
            deletionDuration,
            insertionDuration
        };
    } catch (error) {
        console.error(`❌ Erreur lors de la synchronisation Genius avec SharePoint (InvItems):`, error.message);
        throw error;
    }
};

const replaceSharePointWithGeniusItems = async () => {
    const tableName = 'genius_Tbl_Items';
    const listId = LIST_ID_ITEMS;
    let deletionDuration = 0;
    let insertionDuration = 0;

    try {
        const token = await getAccessToken();
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        // Deletion Phase
        const deletionStart = Date.now();
        let items = [];
        let url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items?expand=fields`;
        while (url) {
            const response = await axios.get(url, { headers });
            items = items.concat(response.data.value);
            url = response.data['@odata.nextLink'];
        }

        if (items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                let attempt = 0;
                let success = false;

                while (attempt < MAX_RETRIES && !success) {
                    try {
                        await axios.delete(
                            `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${item.id}`,
                            { headers }
                        );
                        console.log(`✅ Item ${item.id} supprimé de SharePoint (Items).`);
                        success = true;
                    } catch (error) {
                        attempt++;
                        if (attempt === MAX_RETRIES) {
                            throw new Error(`Échec final de suppression de l'item ${item.id} après ${MAX_RETRIES} tentatives: ${error.message}`);
                        }
                        if (error.response?.status === 429 || error.response?.data?.error?.code === 'activityLimitReached') {
                            const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
                            console.log(`⚠️ Throttling détecté. Attente de ${delay}ms avant la tentative ${attempt + 1}/${MAX_RETRIES}...`);
                            await wait(delay);
                        } else {
                            throw error;
                        }
                    }
                }
                // Removed the delay here: if (i < items.length - 1) await wait(BATCH_DELAY_MS);
            }

            // Verify deletion
            let remainingItems = [];
            url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items?expand=fields`;
            while (url) {
                const response = await axios.get(url, { headers });
                remainingItems = remainingItems.concat(response.data.value);
                url = response.data['@odata.nextLink'];
            }
            if (remainingItems.length > 0) {
                throw new Error(`Échec de suppression complète: ${remainingItems.length} items restants. IDs restants: ${remainingItems.map(item => item.id).join(', ')}`);
            }
            console.log(`✅ Confirmation: Aucun item restant dans SharePoint (Items).`);
        } else {
            console.log(`⚠️ Aucun item à supprimer dans SharePoint (Items).`);
        }
        deletionDuration = Date.now() - deletionStart;
        console.log(`⏱️ Temps de suppression (Items): ${formatDuration(deletionDuration)}`);

        // Insertion Phase
        const insertionStart = Date.now();
        const [geniusData] = await db.execute(`SELECT * FROM ${tableName}`);
        if (geniusData.length === 0) {
            insertionDuration = Date.now() - insertionStart;
            return {
                message: `⚠️ Aucune donnée trouvée dans la table ${tableName}.`,
                deletionDuration,
                insertionDuration
            };
        }

        for (let i = 0; i < geniusData.length; i++) {
            const item = geniusData[i];
            let attempt = 0;
            let success = false;

            while (attempt < MAX_RETRIES && !success) {
                try {
                    const fields = {
                        Title: item.Title,
                        field_1: item.item,
                        field_2: item.Family,
                        field_3: item.Description,
                        field_4: item.Specification1,
                        field_5: Number(item.Prix_Der),
                        field_6: Number(item.Prix_Moyen),
                        field_7: item.Unit,
                        field_8: item.UnitDesc
                    };
                    await axios.post(
                        `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items`,
                        { fields },
                        { headers }
                    );
                    console.log(`✅ Item ${item.Title} inséré dans SharePoint (Items).`);
                    success = true;
                } catch (error) {
                    attempt++;
                    if (attempt === MAX_RETRIES) {
                        throw new Error(`Échec final de l'insertion de l'item ${item.Title} après ${MAX_RETRIES} tentatives: ${error.message}`);
                    }
                    if (error.response?.status === 429 || error.response?.data?.error?.code === 'activityLimitReached') {
                        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
                        console.log(`⚠️ Throttling détecté. Attente de ${delay}ms avant la tentative ${attempt + 1}/${MAX_RETRIES}...`);
                        await wait(delay);
                    } else {
                        throw error;
                    }
                }
            }
            // Removed the delay here: if (i < geniusData.length - 1) await wait(BATCH_DELAY_MS);
        }
        console.log(`✅ ${geniusData.length} items de ${tableName} insérés dans SharePoint (Items).`);
        insertionDuration = Date.now() - insertionStart;
        console.log(`⏱️ Temps d'insertion (Items): ${formatDuration(insertionDuration)}`);

        return {
            message: `✅ ${geniusData.length} items insérés avec succès`,
            deletionDuration,
            insertionDuration
        };
    } catch (error) {
        console.error(`❌ Erreur lors de la synchronisation Genius avec SharePoint (Items):`, error.message);
        throw error;
    }
};

// New SharePoint Sync Function for Tbl_Loc
const syncSharePointLocData = async () => {
    const tableName = 'sharepoint_Tbl_Loc';
    try {
        const token = await getAccessToken();
        const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
        let items = [];
        let url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID_LOC}/items?expand=fields`;

        while (url) {
            const response = await axios.get(url, { headers });
            items = items.concat(response.data.value);
            url = response.data['@odata.nextLink'];
        }

        if (items.length > 0) {
            await createTableIfNotExists(items[0].fields, tableName, fieldMappingsLoc);
            await ensureColumnsExist(items, tableName, fieldMappingsLoc);
            await insertOrUpdateItems(items, tableName, fieldMappingsLoc, true);
            console.log(`✅ ${items.length} items SharePoint stockés dans ${tableName}.`);
        } else {
            console.log("⚠️ Aucun item trouvé dans SharePoint (Tbl_Loc).");
        }
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation SharePoint (Tbl_Loc):", error.message);
        throw error;
    }
};

// New Genius Sync Function for Tbl_Loc
const syncGeniusLocData = async () => {
    const tableName = 'genius_Tbl_Loc';
    try {
        const connection = await connectODBC();
        const sql = `
            SELECT 
                loc.Code, loc.Location, loc.Des
            FROM Localisations loc 
            WHERE LCN_Active=1 AND LCN_CategoryCode='FIXED' AND Des3 = ''
        `;
        const result = await connection.query(sql);
        await connection.close();

        const geniusData = result.map(row => {
            const decodeWith = (encoding) => {
                return {
                    Code: typeof row.Code === 'string' ? iconv.decode(Buffer.from(row.Code, 'binary'), encoding) : row.Code,
                    Location: typeof row.Location === 'string' ? iconv.decode(Buffer.from(row.Location, 'binary'), encoding) : row.Location,
                    Des: typeof row.Des === 'string' ? iconv.decode(Buffer.from(row.Des, 'binary'), encoding) : row.Des
                };
            };

            const cp850Decoded = decodeWith('cp850');
            return {
                Code: cp850Decoded.Code,
                Location: cp850Decoded.Location,
                Des: cp850Decoded.Des
            };
        });

        if (geniusData.length > 0) {
            await db.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
            const columns = [
                'id INT PRIMARY KEY AUTO_INCREMENT',
                '`Code` TEXT',
                '`Location` TEXT',
                '`Des` TEXT'
            ];
            const createSql = `CREATE TABLE \`${tableName}\` (
                ${columns.join(',\n        ')}
            )`;
            await db.execute(createSql);
            console.log(`✅ Table ${tableName} supprimée et recréée avec succès.`);

            for (const item of geniusData) {
                const columns = ['Code', 'Location', 'Des'];
                const values = [item.Code, item.Location, item.Des];
                const sql = `INSERT INTO \`${tableName}\` (${columns.map(col => `\`${col}\``).join(', ')})
                            VALUES (${columns.map(() => '?').join(', ')})
                            ON DUPLICATE KEY UPDATE ${columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ')}`;
                await db.execute(sql, values);
            }
            console.log(`✅ ${geniusData.length} items Genius stockés dans ${tableName}.`);
        } else {
            console.log("⚠️ Aucune donnée trouvée dans Genius (genius_Tbl_Loc).");
        }
    } catch (error) {
        console.error("❌ Erreur lors de la synchronisation Genius (genius_Tbl_Loc):", error.message);
        throw error;
    }
};

// New Replacement Function for Tbl_Loc
const replaceSharePointWithGeniusLoc = async () => {
    const tableName = 'genius_Tbl_Loc';
    const listId = LIST_ID_LOC;
    let deletionDuration = 0;
    let insertionDuration = 0;

    try {
        const token = await getAccessToken();
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        // Deletion Phase
        const deletionStart = Date.now();
        let items = [];
        let url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items?expand=fields`;
        while (url) {
            const response = await axios.get(url, { headers });
            items = items.concat(response.data.value);
            url = response.data['@odata.nextLink'];
        }

        if (items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                let attempt = 0;
                let success = false;

                while (attempt < MAX_RETRIES && !success) {
                    try {
                        await axios.delete(
                            `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${item.id}`,
                            { headers }
                        );
                        console.log(`✅ Item ${item.id} supprimé de SharePoint (Loc).`);
                        success = true;
                    } catch (error) {
                        attempt++;
                        if (attempt === MAX_RETRIES) {
                            throw new Error(`Échec final de suppression de l'item ${item.id} après ${MAX_RETRIES} tentatives: ${error.message}`);
                        }
                        if (error.response?.status === 429 || error.response?.data?.error?.code === 'activityLimitReached') {
                            const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
                            console.log(`⚠️ Throttling détecté. Attente de ${delay}ms avant la tentative ${attempt + 1}/${MAX_RETRIES}...`);
                            await wait(delay);
                        } else {
                            throw error;
                        }
                    }
                }
            }

            // Verify deletion
            let remainingItems = [];
            url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items?expand=fields`;
            while (url) {
                const response = await axios.get(url, { headers });
                remainingItems = remainingItems.concat(response.data.value);
                url = response.data['@odata.nextLink'];
            }
            if (remainingItems.length > 0) {
                throw new Error(`Échec de suppression complète: ${remainingItems.length} items restants. IDs restants: ${remainingItems.map(item => item.id).join(', ')}`);
            }
            console.log(`✅ Confirmation: Aucun item restant dans SharePoint (Loc).`);
        } else {
            console.log(`⚠️ Aucun item à supprimer dans SharePoint (Loc).`);
        }
        deletionDuration = Date.now() - deletionStart;
        console.log(`⏱️ Temps de suppression (Loc): ${formatDuration(deletionDuration)}`);

        // Insertion Phase
        const insertionStart = Date.now();
        const [geniusData] = await db.execute(`SELECT * FROM ${tableName}`);
        if (geniusData.length === 0) {
            insertionDuration = Date.now() - insertionStart;
            return {
                message: `⚠️ Aucune donnée trouvée dans la table ${tableName}.`,
                deletionDuration,
                insertionDuration
            };
        }

        for (let i = 0; i < geniusData.length; i++) {
            const item = geniusData[i];
            let attempt = 0;
            let success = false;

            while (attempt < MAX_RETRIES && !success) {
                try {
                    const fields = {
                        Title: item.Code,
                        field_1: item.Location,
                        field_2: item.Des
                    };
                    await axios.post(
                        `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items`,
                        { fields },
                        { headers }
                    );
                    console.log(`✅ Item ${item.Code} inséré dans SharePoint (Loc).`);
                    success = true;
                } catch (error) {
                    attempt++;
                    if (attempt === MAX_RETRIES) {
                        throw new Error(`Échec final de l'insertion de l'item ${item.Code} après ${MAX_RETRIES} tentatives: ${error.message}`);
                    }
                    if (error.response?.status === 429 || error.response?.data?.error?.code === 'activityLimitReached') {
                        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
                        console.log(`⚠️ Throttling détecté. Attente de ${delay}ms avant la tentative ${attempt + 1}/${MAX_RETRIES}...`);
                        await wait(delay);
                    } else {
                        throw error;
                    }
                }
            }
        }
        console.log(`✅ ${geniusData.length} items de ${tableName} insérés dans SharePoint (Loc).`);
        insertionDuration = Date.now() - insertionStart;
        console.log(`⏱️ Temps d'insertion (Loc): ${formatDuration(insertionDuration)}`);

        return {
            message: `✅ ${geniusData.length} items insérés avec succès`,
            deletionDuration,
            insertionDuration
        };
    } catch (error) {
        console.error(`❌ Erreur lors de la synchronisation Genius avec SharePoint (Loc):`, error.message);
        throw error;
    }
};

// Update module.exports to include new functions
module.exports = {
    syncSharePointData,
    syncSharePointItemsData,
    syncGeniusData,
    syncGeniusItemsData,
    syncSharePointLocData, // Add new function
    syncGeniusLocData,    // Add new function
    addSharePointItem,
    replaceSharePointWithGeniusInvItems,
    replaceSharePointWithGeniusItems,
    replaceSharePointWithGeniusLoc // Add new function
};