require('dotenv').config();

const requiredEnv = ['SESSION_SECRET', 'CSRF_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key] || process.env[key].startsWith('change-me')) {
    console.error(`Variable d'environnement manquante ou non initialisee: ${key}. Voir .env.example.`);
    process.exit(1);
  }
}

const app = require('./app');

const port = parseInt(process.env.PORT, 10) || 3000;
const host = '127.0.0.1';

app.listen(port, host, () => {
  console.log(`FabriCS app en ecoute sur http://${host}:${port}`);
});
