// Seeds the initial actualites (migrated from the old static site) into an
// empty database. Idempotent: does nothing if the table already has rows, so
// it is safe to run on every `make install`.
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const db = require('../src/db');
const { uniqueSlug } = require('../src/lib/slug');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');

const items = [
  {
    title: '🏎️ Shell Eco-marathon : FabriCS brille en Pologne pour sa première participation en partenariat avec Maxi Mômes !',
    excerpt: "Premiers essais d'assemblage du châssis avec les entreprises techniques partenaires du Technopôle. Trois semaines avant le banc d'essai.",
    srcImage: 'cshell-bg.jpg',
    sourceLabel: 'LinkedIn',
    sourceUrl: 'https://www.linkedin.com/posts/fabricsmetz_shellecomarathon-fabrics-centralesupaezlec-activity-7477421957974687745-xpjT?utm_source=share&utm_medium=member_desktop&rcm=ACoAADt-YJ0BRHtpvq7bY-A2gykJkmQwAKchrN4',
    publishedAt: '2026-06-29T00:00:00.000Z',
  },
  {
    title: 'Partenariat avec John Cockerill : le projet CShell passe à la vitesse supérieure',
    excerpt: "Grâce au soutien de John Cockerill, nous reprenons un prototype électrique d'élite pour briller aux Eco-Shell Marathons (Europe & Afrique) et sensibiliser les écoliers messins à l'écomobilité.",
    srcImage: 'john-cockerill.jpg',
    sourceLabel: 'FabriCS',
    sourceUrl: null,
    publishedAt: '2026-06-15T00:00:00.000Z',
  },
  {
    title: 'Des maquettes au tableau : FabriCS soutient la transmission scientifique avec CentraleSupélec',
    excerpt: "Fiers de notre écosystème ! Le Parisien Étudiant met en lumière le projet « EntreÉlèves » de CentraleSupélec Metz. Une initiative de transmission scientifique portée sur le terrain par Anas, notre trésorier, et soutenue en coulisses par FabriCS, qui a assisté les étudiants dans la fabrication de leurs maquettes pédagogiques pour les écoliers.",
    srcImage: 'eleves.JPG',
    sourceLabel: 'LinkedIn',
    sourceUrl: 'https://www.leparisien.fr/etudiant/etudes/ecoles/en-arrivant-aucun-nous-a-parle-dingenieur-ou-de-chercheur-des-etudiants-de-centralesupelec-enseignent-la-science-a-des-ecoliers-QD2GDCHFBJEALN7WDJTHT47YMA.php',
    publishedAt: '2026-04-23T00:00:00.000Z',
  },
];

function slugExists(slug) {
  return Boolean(db.prepare('SELECT id FROM actualites WHERE slug = ?').get(slug));
}

async function processImage(filename) {
  const srcPath = path.join(PUBLIC_DIR, filename);
  const outName = `${crypto.randomBytes(16).toString('hex')}.jpg`;
  const destPath = path.join(UPLOAD_DIR, outName);
  await sharp(srcPath).rotate().jpeg({ quality: 82 }).toFile(destPath);
  return `/uploads/${outName}`;
}

async function main() {
  const { c: existingCount } = db.prepare('SELECT COUNT(*) as c FROM actualites').get();
  if (existingCount > 0) {
    console.log(`seed-actualites: ${existingCount} actualite(s) deja en base, rien a faire.`);
    return;
  }

  for (const item of items) {
    const slug = uniqueSlug(item.title, slugExists);
    const imagePath = await processImage(item.srcImage);
    const publishedAtSeconds = Math.floor(new Date(item.publishedAt).getTime() / 1000);

    db.prepare(
      `INSERT INTO actualites (slug, title, excerpt, image_path, source_label, source_url, published_at, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, unixepoch())`,
    ).run(slug, item.title, item.excerpt, imagePath, item.sourceLabel, item.sourceUrl, publishedAtSeconds);

    console.log('seed-actualites: inserted', slug);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
