const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const multer = require('multer');
const sharp = require('sharp');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TO_FORMAT = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    // A <input type="file"> left empty still produces a zero-size entry with
    // an empty filename when serialized via FormData - let it through here
    // and discard it by size after upload, instead of rejecting the whole
    // request (which would block edits that don't change the image).
    if (file.originalname === '') {
      return cb(null, true);
    }
    if (!ALLOWED_MIME_TO_FORMAT[file.mimetype]) {
      return cb(new Error('Format d’image non autorise (jpg, png ou webp uniquement).'));
    }
    return cb(null, true);
  },
});

// Re-encode via sharp: strips EXIF/metadata and neutralizes any non-image
// payload smuggled inside the file (polyglot files), regardless of the
// original bytes. Also throws if sharp cannot parse it as a real image.
async function persistUploadedImage(file) {
  const format = ALLOWED_MIME_TO_FORMAT[file.mimetype];
  const image = sharp(file.buffer, { failOn: 'error' });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Fichier image invalide.');
  }

  const filename = `${crypto.randomBytes(16).toString('hex')}.${format === 'jpeg' ? 'jpg' : format}`;
  const destination = path.join(UPLOAD_DIR, filename);

  let pipeline = image.rotate();
  if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 82 });
  else if (format === 'png') pipeline = pipeline.png();
  else pipeline = pipeline.webp({ quality: 82 });

  await pipeline.toFile(destination);
  return `/uploads/${filename}`;
}

async function deleteUploadedImage(imagePath) {
  if (!imagePath || !imagePath.startsWith('/uploads/')) return;
  const filename = path.basename(imagePath);
  await fs.rm(path.join(UPLOAD_DIR, filename), { force: true });
}

function hasUploadedFile(file) {
  return Boolean(file && file.size > 0 && file.originalname !== '');
}

module.exports = { upload, persistUploadedImage, deleteUploadedImage, hasUploadedFile, MAX_SIZE_BYTES };
