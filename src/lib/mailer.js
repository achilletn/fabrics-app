const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10) || 587,
    secure: SMTP_SECURE === 'true',
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

// Sends the contact-form notification to the association's mailing list.
// Returns true/false instead of throwing: the caller already persisted the
// message in the database, so a mail relay outage must never be treated as
// the submission itself failing.
async function sendContactNotification({ name, email, intention, message }) {
  const to = process.env.CONTACT_MAILING_LIST;
  const from = process.env.MAIL_FROM;
  const t = getTransporter();

  if (!t || !to || !from) {
    console.error('Mailer non configure (SMTP_HOST/CONTACT_MAILING_LIST/MAIL_FROM manquant) - message non envoye par mail.');
    return false;
  }

  try {
    await t.sendMail({
      from,
      to,
      replyTo: email,
      subject: `[FabriCS - Rejoindre] Nouveau message de ${name}`,
      text: [
        `Nom : ${name}`,
        `Email : ${email}`,
        `Intention : ${intention || 'non precisee'}`,
        '',
        message,
      ].join('\n'),
    });
    return true;
  } catch (err) {
    console.error('Echec envoi mail de contact:', err.message);
    return false;
  }
}

module.exports = { sendContactNotification };
