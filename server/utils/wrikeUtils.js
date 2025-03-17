

// utils/wrikeUtils.js

// 🔹 Fonction pour nettoyer les noms de colonnes
const cleanColumnName = (str) => {
    if (!str || typeof str !== "string") return "unknown_column"; // Protection contre undefined/null
    return str
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, ""); 
};

// 🔹 Mapper les types Wrike vers MySQL
const mapWrikeTypeToSQL = (type) => {
    switch (type) {
        case "Text":
        case "DropDown":
        case "Multiple":
            return "TEXT";
        case "Numeric":
        case "Duration":
            return "INT";
        case "Checkbox":
            return "BOOLEAN";
        case "Date":
            return "DATE";
        case "Currency":
        case "Percentage":
            return "DECIMAL(10,2)";
        default:
            return "TEXT"; 
    }
};

// 🔹 Fonction pour générer le nom de colonne final
const generateColumnName = (fieldTitle) => {
    return `custom_${cleanColumnName(fieldTitle)}`;
};

// 🔹 Correction du format des dates pour MySQL
const formatDateForMySQL = (isoDate) => {
    if (!isoDate || isoDate === "") return null;
    return isoDate.replace("T", " ").replace("Z", "");
};

module.exports = { cleanColumnName, mapWrikeTypeToSQL, generateColumnName, formatDateForMySQL };
