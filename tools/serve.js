// Lance l’application en local : npm start, puis ouvrir l’adresse affichée.
// Usage : npm start, ou PORT=8080 npm start pour choisir le port.

import { startServer } from "./browser.js";

const port = Number(process.env.PORT) || 8000;
const server = await startServer(port);
console.log(`Alterra : http://127.0.0.1:${server.address().port}/ (Ctrl+C pour arrêter)`);
