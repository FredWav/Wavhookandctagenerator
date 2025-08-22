// api/contact.js
const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Middleware CORS
function corsHeaders(res) {
    const origin = process.env.CORS_ORIGIN || "*";
    res.set({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
}

router.options('/', (req, res) => {
    corsHeaders(res);
    res.json({ ok: true });
});

router.post('/', async (req, res) => {
    corsHeaders(res);

    try {
        const { name, email, subject, message } = req.body;

        // Validation
        if (!name || !email || !message) {
            return res.status(400).json({
                error: 'Nom, email et message sont requis'
            });
        }

        // Validation email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Adresse email invalide'
            });
        }

        // Configuration du transporteur email pour LWS
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: false, // false pour port 587 avec STARTTLS
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                // Ignore les certificats auto-signés (commun avec LWS)
                rejectUnauthorized: false
            }
        });

        // Vérifier la connexion SMTP (optionnel pour debug)
        try {
            await transporter.verify();
            console.log('✅ Connexion SMTP vérifiée');
        } catch (verifyError) {
            console.warn('⚠️ Avertissement SMTP:', verifyError.message);
        }

        // Contenu de l'email
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: 'contact@wavsocialscan.com',
            subject: `[Wav Social Scan] ${subject || 'Nouveau contact'} - ${name}`,
            html: `
  <div style="max-width:520px;margin:0 auto;font-family:Inter,Arial,sans-serif;background:#f4f7fb;padding:24px;border-radius:14px;box-shadow:0 4px 24px rgba(123,44,255,.07)">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding-bottom:18px">
          <span style="display:inline-block;background:linear-gradient(90deg,#7b2cff,#00e7ff);border-radius:12px;padding:8px 18px;font-size:22px;font-weight:700;color:#fff;letter-spacing:1px;">Wav Social Scan</span>
        </td>
      </tr>
      <tr>
        <td>
          <h2 style="color:#7b2cff;font-size:23px;margin-bottom:4px;">
            🔥 Nouveau message de contact
          </h2>
        </td>
      </tr>
      <tr>
        <td>
          <table width="100%" style="color:#161627;font-size:16px;line-height:1.7">
            <tr>
              <td><strong>🧑 Nom&nbsp;:</strong></td>
              <td>${name}</td>
            </tr>
            <tr>
              <td><strong>✉️ Email&nbsp;:</strong></td>
              <td><a href="mailto:${email}" style="color:#7b2cff;text-decoration:none">${email}</a></td>
            </tr>
            <tr>
              <td><strong>🏷️ Sujet&nbsp;:</strong></td>
              <td>${subject || 'Non spécifié'}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <div style="margin:22px 0 16px 0">
            <div style="font-weight:600;margin-bottom:5px;color:#00e7ff">💬 Message :</div>
            <div style="background:#fff;padding:18px;border-radius:8px;border-left:5px solid #7b2cff;font-size:16px;line-height:1.6;color:#161627;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#8b90a1;text-align:right;padding-top:10px">
          <hr style="border:none;border-top:1px solid #ececfa;margin-bottom:8px">
          <span>
            📧 Envoyé le ${new Date().toLocaleString('fr-FR')}<br>
            <span style="font-size:12px">Transmis via <strong>Wav Social Scan - Formulaire de contact</strong></span>
          </span>
        </td>
      </tr>
    </table>
  </div>
  `,
            replyTo: email
        };


        // Envoyer l'email
        const info = await transporter.sendMail(mailOptions);

        console.log(`📧 Message de contact envoyé: ${info.messageId}`);
        console.log(`👤 De: ${name} (${email})`);
        console.log(`📝 Sujet: ${subject || 'Non spécifié'}`);

        res.json({
            ok: true,
            message: 'Message envoyé avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur envoi email:', error);

        // Gestion spécifique des erreurs SMTP
        let errorMessage = 'Erreur lors de l\'envoi du message';

        if (error.code === 'EAUTH') {
            errorMessage = 'Erreur d\'authentification SMTP';
            console.error('🔑 Vérifiez vos identifiants SMTP');
        } else if (error.code === 'ECONNECTION') {
            errorMessage = 'Impossible de se connecter au serveur SMTP';
            console.error('🌐 Vérifiez la configuration SMTP (host/port)');
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage = 'Timeout de connexion SMTP';
            console.error('⏰ Le serveur SMTP ne répond pas');
        }

        res.status(500).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
