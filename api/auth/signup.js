const express = require('express');
const router = express.Router();
const { json, setSession, createUser } = require("../utils/auth-util");
const { extractClientInfo, updateUserSignupInfo, logUserAccess } = require('../utils/client-info');
const { generateVerificationToken, sendVerificationEmail } = require('../utils/email-verification');
const pool = require('../db/connection');

router.post('/', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation des champs obligatoires
    if (!username || !email || !password) {
      return json(res, { error: "Tous les champs sont obligatoires" }, 400);
    }

    // Validation du pseudo
    if (username.length < 3 || username.length > 20) {
      return json(res, { error: "Le pseudo doit contenir entre 3 et 20 caractères" }, 400);
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return json(res, { error: "Le pseudo ne peut contenir que des lettres, chiffres et underscore" }, 400);
    }

    // Validation du mot de passe
    if (password.length < 8) {
      return json(res, { error: "Mot de passe trop court (minimum 8 caractères)" }, 400);
    }

    // Créer l'utilisateur
    const user = await createUser(username, email, password);

    // Générer le token de vérification
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Sauvegarder le token en base
    await pool.execute(
      'UPDATE users SET verification_token = ?, token_expires_at = ? WHERE id = ?',
      [verificationToken, expiresAt, user.id]
    );

    // Envoyer l'email de vérification
    try {
      await sendVerificationEmail(email, username, verificationToken);
      console.log(`✅ Email de vérification envoyé à ${email}`);
    } catch (emailError) {
      console.error('Erreur envoi email:', emailError);
      // On continue même si l'email échoue
    }

    // Capturer les infos client
    const clientInfo = extractClientInfo(req);
    updateUserSignupInfo(pool, user.id, clientInfo);
    logUserAccess(pool, user.id, 'signup', clientInfo);

    // NE PAS créer de session tant que l'email n'est pas vérifié
    json(res, {
      ok: true,
      message: "Compte créé avec succès ! Vérifiez votre email pour activer votre compte.",
      emailSent: true
    });

  } catch (error) {
    console.error('Signup error:', error);
    json(res, { error: error.message || "Erreur lors de l'inscription" }, 400);
  }
});

module.exports = router;
