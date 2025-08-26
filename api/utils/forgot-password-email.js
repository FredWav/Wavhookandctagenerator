const nodemailer = require('nodemailer');

// Configuration du transporteur email
const createTransport = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

// Template HTML pour l'email de réinitialisation
const createResetPasswordEmailHTML = (username, resetUrl) => `
  <div style="font-family: Inter, Arial, sans-serif; max-width:600px; margin:0 auto; background:#161627; color:#e6e8ef;">
    <div style="text-align:center; padding:32px 0;">
      <img src="${process.env.FRONTEND_URL}/images/WavSocialScan.svg" alt="Logo Wav Social Scan" style="width:60px; height:60px; margin-bottom:16px;" />
      <h1 style="font-size:28px; letter-spacing:1px; color:#e6e8ef; margin:0;">Réinitialisation du mot de passe</h1>
    </div>
    <div style="background:#12121b; border-radius:20px; padding:32px; box-shadow:0 20px 60px rgba(0,0,0,.4);">
      <p style="font-size:18px; margin-top:0;">Bonjour <strong>${username}</strong>,</p>
      <p style="font-size:16px;">Vous avez demandé à réinitialiser votre mot de passe.<br />Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
      <div style="text-align:center; margin:40px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(90deg,#7b2cff,#00e7ff);color:#12121b;padding:18px 40px;font-size:16px;border-radius:14px;font-weight:600;text-decoration:none;box-shadow:0 4px 20px rgba(123,44,255,0.12);">Réinitialiser mon mot de passe</a>
      </div>
      <p style="font-size:14px;color:#8b90a1; margin-bottom:0;">
        Ce lien expire dans <strong>1 heure</strong> pour des raisons de sécurité.
      </p>
      <p style="font-size:14px; color:#8b90a1; margin-bottom:30px;">
        Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet email. Votre mot de passe restera inchangé.
      </p>
      <hr style="border:none;border-top:1px solid #22223b;margin:24px 0;" />
      <p style="font-size:12px;color:#8b90a1;">
        Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
        <span style="word-break:break-all;">${resetUrl}</span>
      </p>
      <div style="margin-top:32px; text-align:center; font-size:13px; color:#666;">
        Wav Social Scan – Sécurité & Analyse réseaux sociaux
      </div>
    </div>
  </div>
`;

// L’envoi conserve le même usage que votre fonction :
const sendResetPasswordEmail = async (email, username, resetToken) => {
    const transporter = createTransport();
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    const mailOptions = {
        from: `"Wav Social Scan" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '[Wav Social Scan] Réinitialisation de votre mot de passe',
        html: createResetPasswordEmailHTML(username, resetUrl),
        text:
            `Bonjour ${username},

Vous avez demandé la réinitialisation de votre mot de passe.

Lien : ${resetUrl}

Ce lien expirera dans 1 heure.

Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.`
    };
    await transporter.sendMail(mailOptions);
};


module.exports = {
    sendResetPasswordEmail
};
