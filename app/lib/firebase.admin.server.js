import * as admin from "firebase-admin";

const serviceAccount = require("../service-account.json");

if (admin.apps.length > 0) {
    console.log('warn: app already initialized :(');
}

const adminApp = global.adminApp || admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
global.adminApp = adminApp;

export default adminApp;