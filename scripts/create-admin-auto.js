// Non-interactive staff account bootstrap for `make install` on a fresh VM.
// Idempotent: does nothing if a staff account already exists. Generates a
// random password and prints it once - it is not stored anywhere else, so
// save it immediately (or run `npm run create-staff` afterwards to add
// further accounts / change it).
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('../src/db');

const USERNAME = process.env.ADMIN_USERNAME || 'admin';

async function main() {
  const existing = db.prepare('SELECT id FROM staff').get();
  if (existing) {
    console.log('create-admin-auto: un compte staff existe deja, rien a faire.');
    return;
  }

  const password = crypto.randomBytes(15).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);

  db.prepare('INSERT INTO staff (username, password_hash) VALUES (?, ?)').run(USERNAME, passwordHash);

  console.log('');
  console.log('========================================================');
  console.log(' Compte admin cree :');
  console.log(`   utilisateur : ${USERNAME}`);
  console.log(`   mot de passe : ${password}`);
  console.log(' Notez-le maintenant, il ne sera plus jamais affiche.');
  console.log(' Changez-le ou ajoutez un autre compte via :');
  console.log('   npm run create-staff');
  console.log('========================================================');
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
