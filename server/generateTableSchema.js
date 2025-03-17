//generateTableSchema.js
const axios = require('axios');
const fs = require('fs');
const db = require('./config/db');
const { cleanColumnName, mapWrikeTypeToSQL, generateColumnName } = require('./utils/wrikeUtils');
require('dotenv').config();

const WRIKE_API_TOKEN = process.env.WRIKE_API_TOKEN;
const headers = {
    Authorization: `Bearer ${WRIKE_API_TOKEN}`,
    'Content-Type': 'application/json'
};

// 🔹 Générer la table avec les colonnes dynamiques
const generateTableSQL = async () => {
    try {
        console.log("🔄 Récupération des Custom Fields depuis Wrike...");
        const response = await axios.get("https://www.wrike.com/api/v4/customfields", { headers });

        const customFields = response.data.data;
        if (!customFields || customFields.length === 0) {
            console.error("⚠️ Aucun champ personnalisé trouvé !");
            return;
        }

        let sql = `
        CREATE TABLE wrike_projects (
            id VARCHAR(50) PRIMARY KEY,
            permalink TEXT,
            FM_NoCom TEXT,
            account_id VARCHAR(50),
            title TEXT,
            created_date DATETIME,
            updated_date DATETIME,
            workflow_id VARCHAR(50),
            fm_link VARCHAR(50),
        `;

        customFields.forEach(field => {
            const columnName = generateColumnName(field.title);
            const sqlType = mapWrikeTypeToSQL(field.type);
            sql += `\n    ${columnName} ${sqlType},`;
        });

        sql = sql.slice(0, -1); // Supprime la dernière virgule
        sql += "\n);";

        console.log("✅ Requête SQL générée avec succès !");
        console.log(sql);

        // Sauvegarde dans un fichier SQL
        fs.writeFileSync("wrike_projects_schema.sql", sql);
        console.log("📁 Requête SQL sauvegardée dans 'wrike_projects_schema.sql'");

    } catch (error) {
        console.error("❌ Erreur lors de la récupération des Custom Fields :", error.message);
    }
};

// Exécution
generateTableSQL();
