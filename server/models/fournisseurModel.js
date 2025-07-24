const pool = require('../config/dbmigration');
const { connectODBC } = require('../config/odbcConfig');
const { stringify } = require('csv-stringify');
const iconv = require('iconv-lite');

// Helper function to convert from binary to UTF-8
const convertToUTF8 = (value) => {
  if (value == null) return '';
  if (typeof value !== 'string') value = value.toString();
  const rawBuffer = Buffer.from(value, 'binary');
  console.log(`Raw value: ${value} (HEX: ${rawBuffer.toString('hex')})`);
  return value; // Return as-is; we'll fix exceptions manually
};

// Helper function to fix specific special character exceptions
const fixSpecialCharacterExceptions = (value) => {
  if (typeof value !== 'string') return value;

  let corrected = value
    .replace(/KILOTECH CONTR�LE INC/g, 'KILOTECH CONTRÉLE INC') // Fix É in KILOTECH CONTRÉLE INC
    .replace(/6750 Saint-Fran�ois/g, '6750 Saint-François') // Fix ç in Saint-François
    .replace(/Marc-Andr�/g, 'Marc-André') // Fix é in Marc-André
    .replace(/No�l/g, 'Noël') // Fix ë in Noël
    .replace(/B�LANGER/g, 'BÉLANGER') // Fix É in BÉLANGER
    .replace(/Marie-�ve/g, 'Marie-Ève') // Fix È in Marie-Ève
    .replace(/Rh�anne/g, 'Rhéanne') // Fix é in Rhéanne
    .replace(/MONTR�AL/g, 'MONTRÉAL') // Fix É in MONTRÉAL
    .replace(/�TALFORT/g, 'ÉTALFORT') // Fix É in ÉTALFORT
    .replace(/6117 RUE DE L'�GLISE/g, "6117 RUE DE L'ÉGLISE") // Fix É in 6117 RUE DE L'ÉGLISE
    .replace(/550 MONT�E DE LIESSE/g, '550 MONTÉE DE LIESSE') // Fix É in 550 MONTÉE DE LIESSE
    .replace(/2223, DE LA M�TROPOLE/g, '2223, DE LA MÉTROPOLE') // Fix É in 2223, DE LA MÉTROPOLE
    .replace(/�TIQUETTES RIVE-SUD/g, 'ÉTIQUETTES RIVE-SUD') // Fix É in ÉTIQUETTES RIVE-SUD
    .replace(/LES CL�TURES ARBOIT INC./g, 'LES CLÔTURES ARBOIT INC.') // Fix Ô in LES CLÔTURES ARBOIT INC.
    // Generic fallback for remaining � characters
    .replace(/\uFFFD/g, 'É'); // Replace � with É as a fallback

  if (corrected !== value) {
    console.log(`Corrected: ${value} → ${corrected} (HEX: ${Buffer.from(corrected).toString('hex')})`);
  }
  return corrected;
};

// Helper function to validate PaymentModeId
const validatePaymentModeId = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10);
  if (Number.isInteger(value)) return value;
  console.warn(`Invalid PaymentModeId value: ${value} (type: ${typeof value})`);
  return null;
};

// Helper function to parse contact
const parseContact = (contact) => {
  let firstName = '', middleName = '', lastName = '';
  if (!contact || typeof contact !== 'string' || contact.toLowerCase().includes('online buy')) {
    return { firstName, middleName, lastName };
  }
  const emailMatch = contact.match(/<(.+@.+)>/);
  let namePart = emailMatch ? contact.split('<')[0].trim() : contact.trim();
  if (emailMatch && !namePart) {
    const emailName = emailMatch[1].split('@')[0];
    const emailParts = emailName.split(/[_.-]/);
    if (emailParts.length >= 2) {
      firstName = emailParts[0];
      lastName = emailParts.slice(1).join('');
    } else {
      lastName = emailName;
    }
  } else if (!emailMatch && contact.includes('@')) {
    const emailParts = contact.split('@')[0].split(/[_.-]/);
    if (emailParts.length >= 2) {
      firstName = emailParts[0];
      lastName = emailParts.slice(1).join('');
    } else {
      lastName = emailParts[0];
    }
  } else {
    namePart = namePart.replace(/[,\/].*$/, '').trim();
    const parts = namePart.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      firstName = parts[0];
    } else if (parts.length === 2) {
      if (parts[0].includes('-')) {
        firstName = parts[0];
        lastName = parts[1];
      } else if (parts[1].includes('-')) {
        firstName = parts[0];
        lastName = parts[1];
      } else {
        firstName = parts[0];
        lastName = parts[1];
      }
    } else if (parts.length >= 3) {
      if (parts[1].includes('-')) {
        firstName = parts[0];
        lastName = `${parts[1]} ${parts[2]}`;
      } else {
        firstName = parts[0];
        middleName = parts.slice(1, -1).join(' ');
        lastName = parts[parts.length - 1];
      }
    }
  }
  return { firstName, middleName, lastName };
};

const fournisseurModel = {
  async createTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS fournisseurgenius_import (
        custentity_gs_vendor_number VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci PRIMARY KEY,
        vendorId VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        companyName VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        printOnCheckAs VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        address1_line1 VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        address1_line2 VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        address1_city VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        address1_state VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        address1_countrys VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        address1_zipCode VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        phone VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        fax VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        First VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Middle VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Last VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        terms VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        currency VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        custentity_gs_ship_mth VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        language VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        incoterm VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        email VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        custentity_gs_str_date DATE,
        category VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        externalid VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        custentity_gs_pay_mth_ven VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        EFT CHAR(1),
        address1_defaultShipping CHAR(1),
        address1_defaultBilling CHAR(1),
        Legalname VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        is1099Eligible CHAR(1),
        isPerson CHAR(1),
        subsidiary VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`;
    try {
      const connection = await pool.getConnection();
      await connection.query(createTableQuery);
      connection.release();
      return { success: true, message: 'Table fournisseurgenius_import created successfully' };
    } catch (error) {
      throw new Error(`Failed to create table: ${error.message}`);
    }
  },

  async createTempTable() {
    const createTempTableQuery = `
      CREATE TABLE IF NOT EXISTS temp_fournisseur_genius (
        F_No VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Nom VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        CheckName VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Adresse VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        VDS_Address2 VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Ville VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Pays VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Province VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Codepostal VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Telephone VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Fax VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        contact VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Termeach VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Devise VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Transport VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        langue VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Modeexp VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        datecree DATE,
        Classification VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        vds_link VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        PaymentModeId INT,
        First VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Middle VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
        Last VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`;
    try {
      const connection = await pool.getConnection();
      await connection.query(createTempTableQuery);
      connection.release();
      return { success: true, message: 'Temporary table created successfully' };
    } catch (error) {
      throw new Error(`Failed to create temporary table: ${error.message}`);
    }
  },

  async fetchGeniusData() {
    const geniusQuery = `
      SELECT 
        F_No,
        Nom,
        CheckName,
        Adresse,
        VDS_Address2,
        Ville,
        Pays,
        Province,
        Codepostal,
        Telephone,
        Fax,
        contact,
        Termeach,
        Devise,
        Transport,
        langue,
        Modeexp,
        datecree,
        Classification,
        vds_link,
        PaymentModeId
      FROM Fou
      WHERE 
        Actif = 'O' 
        AND F_no = VDS_PaidToVendorLink 
        AND (Pays = 'CANADA' OR Pays = 'USA')
        AND Adresse <> ''
        AND F_NO NOT LIKE '%-%'
        AND Modeexp NOT IN ('PPC', 'COD', 'COLLECT')
    `;
    try {
      const connection = await connectODBC();
      console.log('Connexion ODBC établie avec succès.');
      const result = await connection.query(geniusQuery);
      console.log('Requête exécutée avec succès, nombre de lignes récupérées:', result.length);
      await connection.close();
      const cleanedData = result.map((row) => {
        Object.keys(row).forEach((key) => {
          console.log(`Processing field ${key} for F_No ${row.F_No}`);
          row[key] = convertToUTF8(row[key]);
          row[key] = fixSpecialCharacterExceptions(row[key]);
        });
  
        row.PaymentModeId = validatePaymentModeId(row.PaymentModeId);
        const { firstName, middleName, lastName } = parseContact(row.contact);
        return { ...row, First: firstName, Middle: middleName, Last: lastName };
      });
      return cleanedData;
    } catch (error) {
      console.error('Erreur ODBC détaillée:', error);
      console.error('Code d\'erreur:', error.code);
      console.error('Message d\'erreur:', error.message);
      console.error('Détails supplémentaires:', error.errors || error);
      throw new Error(`Failed to fetch data from Genius: ${error.message}`);
    }
  },

  async syncData() {
    try {
      await this.createTable();
      await this.createTempTable();

      const geniusData = await this.fetchGeniusData();
      const connection = await pool.getConnection();
      await connection.query('SET SESSION character_set_client = utf8mb4');
      await connection.query('SET SESSION character_set_results = utf8mb4');
      await connection.query('SET SESSION character_set_connection = utf8mb4');
      await connection.query('TRUNCATE TABLE temp_fournisseur_genius');
      const insertTempQuery = `
        INSERT INTO temp_fournisseur_genius (
          F_No, Nom, CheckName, Adresse, VDS_Address2, Ville, Pays, Province, Codepostal,
          Telephone, Fax, contact, Termeach, Devise, Transport, langue, Modeexp, datecree,
          Classification, vds_link, PaymentModeId, First, Middle, Last
        ) VALUES ?
      `;
      const tempValues = geniusData.map(row => [
        row.F_No, row.Nom, row.CheckName, row.Adresse, row.VDS_Address2, row.Ville,
        row.Pays, row.Province, row.Codepostal, row.Telephone, row.Fax, row.contact,
        row.Termeach, row.Devise, row.Transport, row.langue, row.Modeexp, row.datecree,
        row.Classification, row.vds_link, row.PaymentModeId, row.First, row.Middle, row.Last
      ]);
      if (tempValues.length > 0) {
        await connection.query(insertTempQuery, [tempValues]);
      }

      // Log data inserted into temp_fournisseur_genius for debugging
      const [tempRows] = await connection.query('SELECT F_No, Nom, Adresse, Ville, First, Last FROM temp_fournisseur_genius');
      tempRows.forEach(row => {
        console.log(`Temp table - F_No: ${row.F_No}, Nom: ${row.Nom} (HEX: ${Buffer.from(row.Nom).toString('hex')}), Adresse: ${row.Adresse} (HEX: ${Buffer.from(row.Adresse || '').toString('hex')}), Ville: ${row.Ville} (HEX: ${Buffer.from(row.Ville).toString('hex')}), First: ${row.First} (HEX: ${Buffer.from(row.First || '').toString('hex')}), Last: ${row.Last} (HEX: ${Buffer.from(row.Last || '').toString('hex')})`);
      });

      const transformQuery = `
        INSERT INTO fournisseurgenius_import (
          custentity_gs_vendor_number, vendorId, companyName, printOnCheckAs, address1_line1, address1_line2,
          address1_city, address1_state, address1_countrys, address1_zipCode, phone, fax, First, Middle, Last,
          terms, currency, custentity_gs_ship_mth, language, incoterm, email, custentity_gs_str_date, category,
          externalid, custentity_gs_pay_mth_ven, EFT, address1_defaultShipping, address1_defaultBilling,
          Legalname, is1099Eligible, isPerson, subsidiary
        )
        SELECT 
          Fou.F_No AS custentity_gs_vendor_number,
          Fou.Nom AS vendorId,
          Fou.Nom AS companyName,
          CASE WHEN Fou.CheckName = Fou.Nom THEN '' ELSE Fou.CheckName END AS printOnCheckAs,
          Fou.Adresse AS address1_line1,
          Fou.VDS_Address2 AS address1_line2,
          Fou.Ville AS address1_city,
          ppm.provincenetsuite AS address1_state,
          ppm.paysnetsuite AS address1_countrys,
          Fou.Codepostal AS address1_zipCode,
          Fou.Telephone AS phone,
          Fou.Fax AS fax,
          Fou.First,
          Fou.Middle,
          Fou.Last,
          tm.terms_netsuite AS terms,
          cm.currency_netsuite AS currency,
          tpm.netsuite_transport AS custentity_gs_ship_mth,
          CASE
            WHEN Fou.langue = 'FRENCH' THEN 'French (Canada)'
            WHEN Fou.langue = 'ENGLISH' THEN 'English (U.S.)'
            ELSE ''
          END AS language,
          incom.incoterm_netsuite AS incoterm,
          '' AS email,
          CAST(Fou.datecree AS DATE) AS custentity_gs_str_date,
          catm.netsuitecategory AS category,
          Fou.vds_link AS externalid,
          modepm.internal_id_netsuite AS custentity_gs_pay_mth_ven,
          CASE WHEN Fou.PaymentModeId = 2 THEN 'T' ELSE 'F' END AS EFT,
          'T' AS address1_defaultShipping,
          'T' AS address1_defaultBilling,
          '' AS Legalname,
          'F' AS is1099Eligible,
          'F' AS isPerson,
          'Mindcore' AS subsidiary
        FROM temp_fournisseur_genius Fou
        LEFT JOIN terms_mapping tm ON Fou.Termeach COLLATE utf8mb4_0900_ai_ci = tm.terms_genius 
        LEFT JOIN currency_mapping cm ON Fou.Devise COLLATE utf8mb4_0900_ai_ci = cm.currency_genius
        LEFT JOIN transport_mapping tpm ON Fou.Transport COLLATE utf8mb4_0900_ai_ci = tpm.genius_transport 
        LEFT JOIN incoterm_mapping incom ON Fou.Modeexp COLLATE utf8mb4_0900_ai_ci = incom.incoterm_genius 
        LEFT JOIN modepaiement_mapping modepm ON Fou.PaymentModeId = modepm.id_genuis 
        LEFT JOIN pays_province_mapping ppm ON Fou.Pays = ppm.paysgenius AND Fou.Province = ppm.provincegenius 
        LEFT JOIN category_mapping catm ON Fou.Classification COLLATE utf8mb4_0900_ai_ci = catm.geniuscategory
        ON DUPLICATE KEY UPDATE
          vendorId = VALUES(vendorId),
          companyName = VALUES(companyName),
          printOnCheckAs = VALUES(printOnCheckAs),
          address1_line1 = VALUES(address1_line1),
          address1_line2 = VALUES(address1_line2),
          address1_city = VALUES(address1_city),
          address1_state = VALUES(address1_state),
          address1_countrys = VALUES(address1_countrys),
          address1_zipCode = VALUES(address1_zipCode),
          phone = VALUES(phone),
          fax = VALUES(fax),
          First = VALUES(First),
          Middle = VALUES(Middle),
          Last = VALUES(Last),
          terms = VALUES(terms),
          currency = VALUES(currency),
          custentity_gs_ship_mth = VALUES(custentity_gs_ship_mth),
          language = VALUES(language),
          incoterm = VALUES(incoterm),
          email = VALUES(email),
          custentity_gs_str_date = VALUES(custentity_gs_str_date),
          category = VALUES(category),
          externalid = VALUES(externalid),
          custentity_gs_pay_mth_ven = VALUES(custentity_gs_pay_mth_ven),
          EFT = VALUES(EFT),
          address1_defaultShipping = VALUES(address1_defaultShipping),
          address1_defaultBilling = VALUES(address1_defaultBilling),
          Legalname = VALUES(Legalname),
          is1099Eligible = VALUES(is1099Eligible),
          isPerson = VALUES(isPerson),
          subsidiary = VALUES(subsidiary)
      `;
      await connection.query(transformQuery);

      const [existingRecords] = await connection.query('SELECT custentity_gs_vendor_number FROM fournisseurgenius_import');
      const existingIds = new Set(existingRecords.map(row => row.custentity_gs_vendor_number));
      const newIds = new Set(geniusData.map(row => row.F_No));

      const idsToDelete = [...existingIds].filter(id => !newIds.has(id));
      if (idsToDelete.length > 0) {
        await connection.query('DELETE FROM fournisseurgenius_import WHERE custentity_gs_vendor_number IN (?)', [idsToDelete]);
      }

      connection.release();
      return {
        success: true,
        message: `Synchronization completed: ${tempValues.length} processed, ${idsToDelete.length} deleted`
      };
    } catch (error) {
      throw new Error(`Failed to sync data: ${error.message}`);
    }
  },

  async downloadCSV() {
    try {
      const connection = await pool.getConnection();
      await connection.query('SET SESSION character_set_client = utf8mb4');
      await connection.query('SET SESSION character_set_results = utf8mb4');
      await connection.query('SET SESSION character_set_connection = utf8mb4');
      const [rows] = await connection.query('SELECT * FROM fournisseurgenius_import');
      connection.release();
  
      const columns = [
        'custentity_gs_vendor_number', 'vendorId', 'companyName', 'printOnCheckAs', 'address1_line1',
        'address1_line2', 'address1_city', 'address1_state', 'address1_countrys', 'address1_zipCode',
        'phone', 'fax', 'First', 'Middle', 'Last', 'terms', 'currency', 'custentity_gs_ship_mth',
        'language', 'incoterm', 'email', 'custentity_gs_str_date', 'category', 'externalid',
        'custentity_gs_pay_mth_ven', 'EFT', 'address1_defaultShipping', 'address1_defaultBilling',
        'Legalname', 'is1099Eligible', 'isPerson', 'subsidiary', 'last_updated'
      ];
  
      return new Promise((resolve, reject) => {
        const bom = '\uFEFF';
        stringify(rows, {
          header: true,
          columns: columns,
        }, (err, output) => {
          if (err) return reject(new Error(`Failed to generate CSV: ${err.message}`));
          const csvWithBom = bom + output;
          resolve(csvWithBom);
        });
      });
    } catch (error) {
      throw new Error(`Failed to download CSV: ${error.message}`);
    }
  },

  async dropTable() {
    try {
      const connection = await pool.getConnection();
      await connection.query('DROP TABLE IF EXISTS fournisseurgenius_import');
      await connection.query('DROP TABLE IF EXISTS temp_fournisseur_genius');
      connection.release();
      return { success: true, message: 'Tables dropped successfully' };
    } catch (error) {
      throw new Error(`Failed to drop tables: ${error.message}`);
    }
  }
};

module.exports = fournisseurModel;