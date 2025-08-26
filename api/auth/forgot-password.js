const express = require('express');
const router = express.Router();
const { json } = require('../utils/auth-util');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db/connection');
const { sendResetPasswordEmail } = require('../utils/forgot-password-email');

router.post('/', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return json(res, { error: 'Email requis' }, 400);
        }

        const connection = await pool.getConnection();

        try {
            // Vérifier si l'utilisateur existe
            const [users] = await connection.execute(
                'SELECT id, username FROM users WHERE email = ?',
                [email]
            );

            // Toujours retourner le même message pour éviter l'énumération d'emails
            if (users.length === 0) {
                return json(res, { 
                    ok: true, 
                    message: 'Si cette adresse email existe, vous recevrez un lien de réinitialisation.' 
                });
            }

            const user = users[0];

            // Générer un token de réinitialisation
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenHash = await bcrypt.hash(resetToken, 12);
            const expiresAt = new Date(Date.now() + 3600000); // 1 heure

            // Supprimer les anciens tokens pour cet utilisateur
            await connection.execute(
                'DELETE FROM password_reset_tokens WHERE user_id = ?',
                [user.id]
            );

            // Insérer le nouveau token
            await connection.execute(
                'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
                [user.id, resetTokenHash, expiresAt]
            );

            // Envoyer l'email de réinitialisation
            try {
                await sendResetPasswordEmail(email, user.username, resetToken);
                console.log(`✅ Email de réinitialisation envoyé à ${email}`);
            } catch (emailError) {
                console.error('Erreur envoi email:', emailError);
                // On continue même si l'email échoue
            }

            return json(res, { 
                ok: true, 
                message: 'Si cette adresse email existe, vous recevrez un lien de réinitialisation.' 
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Erreur forgot password:', error);
        return json(res, { error: 'Erreur serveur' }, 500);
    }
});

module.exports = router;
