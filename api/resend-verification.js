const express = require('express');
const router = express.Router();
const { json } = require('../utils/auth-util');
const { generateVerificationToken, sendVerificationEmail } = require('../utils/email-verification');
const pool = require('../db/connection');

router.post('/', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return json(res, { error: "Email requis" }, 400);
    }

    // Chercher l'utilisateur
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND email_verified = FALSE',
      [email]
    );

    if (rows.length === 0) {
      return json(res, { error: "Utilisateur non trouvé ou email déjà vérifié" }, 404);
    }

    const user = rows[0];

    // Générer un nouveau token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.execute(
      'UPDATE users SET verification_token = ?, token_expires_at = ? WHERE id = ?',
      [verificationToken, expiresAt, user.id]
    );

    // Renvoyer l'email
    await sendVerificationEmail(email, user.username, verificationToken);

    json(res, {
      ok: true,
      message: "Email de vérification renvoyé !"
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    json(res, { error: "Erreur lors de l'envoi" }, 500);
  }
});

module.exports = router;
