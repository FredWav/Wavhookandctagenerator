const express = require('express');
const router = express.Router();
const { requireUser, json } = require('../utils/auth-util');
const bcrypt = require('bcrypt');
const pool = require('../db/connection');

router.put('/', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return json(res, { error: 'Champs obligatoires manquants' }, 400);
    }

    if (newPassword.length < 8) {
      return json(res, { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' }, 400);
    }

    const connection = await pool.getConnection();

    try {
      // Vérifier mot de passe actuel
      const [rows] = await connection.execute(
        'SELECT password_hash FROM users WHERE id = ?',
        [user.id]
      );

      if (rows.length === 0) {
        return json(res, { error: 'Utilisateur non trouvé' }, 404);
      }

      const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!isValid) {
        return json(res, { error: 'Mot de passe actuel invalide' }, 400);
      }

      // Hasher nouveau mot de passe
      const newHash = await bcrypt.hash(newPassword, 12);

      // Mettre à jour
      await connection.execute(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newHash, user.id]
      );

      return json(res, { ok: true, message: 'Mot de passe modifié avec succès' });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    return json(res, { error: 'Erreur serveur' }, 500);
  }
});

module.exports = router;
