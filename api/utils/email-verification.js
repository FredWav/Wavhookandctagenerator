const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configuration du transporteur (similaire à votre contact.js)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Générer un token de vérification
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Envoyer l'email de vérification
async function sendVerificationEmail(email, username, token) {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: '[Wav Social Scan] Vérifiez votre adresse email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; padding: 20px;">
          <img src="${process.env.FRONTEND_URL}/images/WavSocialScan.svg" alt="Wav Social Scan" style="width: 60px; height: 60px;">
          <h1 style="color: #333;">Bienvenue sur Wav Social Scan !</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
          <h2>Bonjour ${username},</h2>
          <p>Merci de vous être inscrit sur Wav Social Scan ! Pour finaliser votre inscription, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Vérifier mon email
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">
            Wav Social Scan - Analyse des réseaux sociaux
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

module.exports = {
  generateVerificationToken,
  sendVerificationEmail
};
