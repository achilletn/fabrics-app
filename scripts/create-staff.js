require('dotenv').config();
const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const db = require('../src/db');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

// Masks the echoed input for a single question by temporarily suppressing
// readline's internal output writer. Falls back to plain visible input when
// stdin is not a real TTY (piped input can't be masked in raw mode anyway).
function askHidden(question) {
  if (!process.stdin.isTTY) {
    return ask(question);
  }

  return new Promise((resolve) => {
    const originalWriteToOutput = rl._writeToOutput;
    rl._writeToOutput = function maskedWrite(stringToWrite) {
      if (stringToWrite === '\r\n' || stringToWrite === '\n') {
        process.stdout.write(stringToWrite);
      }
    };
    process.stdout.write(question);
    rl.question('', (answer) => {
      rl._writeToOutput = originalWriteToOutput;
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const username = (await ask('Nom d’utilisateur staff : ')).trim();
  if (!username || username.length > 100) {
    console.error('Nom d’utilisateur invalide.');
    process.exitCode = 1;
    return rl.close();
  }

  const existing = db.prepare('SELECT id FROM staff WHERE username = ?').get(username);
  if (existing) {
    console.error('Ce nom d’utilisateur existe deja.');
    process.exitCode = 1;
    return rl.close();
  }

  const password = await askHidden('Mot de passe (min. 12 caracteres) : ');
  if (!password || password.length < 12) {
    console.error('Le mot de passe doit contenir au moins 12 caracteres.');
    process.exitCode = 1;
    return rl.close();
  }

  const confirm = await askHidden('Confirmer le mot de passe : ');
  if (password !== confirm) {
    console.error('Les mots de passe ne correspondent pas.');
    process.exitCode = 1;
    return rl.close();
  }

  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare('INSERT INTO staff (username, password_hash) VALUES (?, ?)').run(username, passwordHash);

  console.log(`Compte staff "${username}" cree avec succes.`);
  return rl.close();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
    rl.close();
  });
