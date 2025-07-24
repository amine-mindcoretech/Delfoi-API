// utils/sendErrorEmail.js
const axios = require('axios');
const qs = require('qs');
require('dotenv').config();

let ACCESS_TOKEN = null;
let tokenExpiry = null;

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
        console.log("✅ Token Graph API généré avec succès.");
        return ACCESS_TOKEN;
    } catch (error) {
        console.error("❌ Échec de génération du token Graph:", error.response?.data || error.message);
        throw error;
    }
};

const notifyByEmail = async (subject, body, to = ["myaakoubi@mindcoretech.com","mlavoie@mindcoretech.com"]) => {
    try {
        const token = await getAccessToken();
        const sender = process.env.GRAPH_SENDER_EMAIL;
        const GRAPH_API_URL = `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`;

        const message = {
            message: {
                subject,
                body: {
                    contentType: "Text",
                    content: body
                },
                toRecipients: to.map(email => ({
                    emailAddress: { address: email }
                }))
            },
            saveToSentItems: "false"
        };

        await axios.post(GRAPH_API_URL, message, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("📧 Email envoyé avec succès via Graph API.");
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de l'email Graph:", error.response?.data || error.message);
    }
};

module.exports = notifyByEmail;
