const express = require('express');
const router = express.Router();
const { json } = require('../utils/auth-util');
const bcrypt = require('bcryptjs');
const pool = require('../db/connection');

router.post('/', async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;

        if (!email || !token || !newPassword) {
            return json(res, { error: 'Tous les champs sont requis' }, 400);
        }

        if (newPassword.length < 8) {
            return json(res, { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' }, 400);
        }

        const connection = await pool.getConnection();

        try {
            // Récupérer l'utilisateur et son token de réinitialisation
            const [results] = await connection.execute(`
                SELECT u.id, prt.token_hash, prt.expires_at 
                FROM users u
                JOIN password_reset_tokens prt ON u.id = prt.user_id
                WHERE u.email = ? AND prt.expires_at > NOW()
            `, [email]);

            if (results.length === 0) {
                return json(res, { error: 'Token invalide ou expiré' }, 400);
            }

            const { id: userId, token_hash, expires_at } = results[0];

            // Vérifier le token
            const isValidToken = await bcrypt.compare(token, token_hash);
            if (!isValidToken) {
                return json(res, { error: 'Token invalide' }, 400);
            }

            // Hasher le nouveau mot de passe
            const newPasswordHash = await bcrypt.hash(newPassword, 12);

            // Mettre à jour le mot de passe
            await connection.execute(
                'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newPasswordHash, userId]
            );

            // Supprimer le token utilisé
            await connection.execute(
                'DELETE FROM password_reset_tokens WHERE user_id = ?',
                [userId]
            );

            return json(res, { 
                ok: true, 
                message: 'Mot de passe réinitialisé avec succès' 
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Erreur reset password:', error);
        return json(res, { error: 'Erreur serveur' }, 500);
    }
});

module.exports = router;
