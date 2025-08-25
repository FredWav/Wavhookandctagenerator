const express = require('express');
const router = express.Router();
const { json, setSession } = require('./utils/auth-util');
const pool = require('./db/connection');

router.get('/', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return json(res, { error: "Token de vérification manquant" }, 400);
    }

    // Chercher l'utilisateur avec ce token
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE verification_token = ? AND token_expires_at > NOW() AND email_verified = FALSE',
      [token]
    );

    if (rows.length === 0) {
      return json(res, { error: "Token invalide ou expiré" }, 400);
    }

    const user = rows[0];

    // Marquer l'email comme vérifié
    await pool.execute(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL, token_expires_at = NULL WHERE id = ?',
      [user.id]
    );

    // Créer la session maintenant que l'email est vérifié
    const cookie = setSession(user);
    res.setHeader('Set-Cookie', cookie);

    json(res, {
      ok: true,
      user: {
        username: user.username,
        email: user.email,
        plan: user.plan
      },
      message: "Email vérifié avec succès ! Vous êtes maintenant connecté."
    });

  } catch (error) {
    console.error('Email verification error:', error);
    json(res, { error: "Erreur lors de la vérification" }, 500);
  }
});

module.exports = router;
