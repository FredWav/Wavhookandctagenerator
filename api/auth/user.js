const express = require('express');
const router = express.Router();
const { requireUser, json } = require('../utils/auth-util');
const bcrypt = require('bcrypt');
const pool = require('../db/connection');

// Mettre à jour les préférences utilisateur
router.put('/preferences', async (req, res) => {
    try {
        const user = await requireUser(req);
        const { emailNotifications, autoSaveHistory } = req.body;

        const connection = await pool.getConnection();

        try {
            // Mettre à jour les préférences (ou créer la table si nécessaire)
            await connection.execute(`
        INSERT INTO user_preferences (user_id, email_notifications, auto_save_history)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
        email_notifications = VALUES(email_notifications),
        auto_save_history = VALUES(auto_save_history)
      `, [
                user.id,
                emailNotifications ? 1 : 0,
                autoSaveHistory ? 1 : 0
            ]);

            return json(res, { ok: true, message: 'Préférences sauvegardées' });

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Erreur mise à jour préférences:', error);
        return json(res, { error: error.message || 'Erreur serveur' }, 500);
    }
});

// Récupérer les préférences utilisateur
router.get('/preferences', async (req, res) => {
    try {
        const user = await requireUser(req);
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(
                'SELECT * FROM user_preferences WHERE user_id = ?',
                [user.id]
            );

            console.log('Raw rows:', JSON.stringify(rows, null, 2));

            if (rows.length > 0) {
                const row = rows[0];

                console.log('email_notifications:', row.email_notifications, typeof row.email_notifications);
                console.log('auto_save_history:', row.auto_save_history, typeof row.auto_save_history);

                // Version très explicite
                const emailNotif = row.email_notifications;
                const autoSave = row.auto_save_history;

                console.log('emailNotif == 1:', emailNotif == 1);
                console.log('autoSave == 1:', autoSave == 1);

                const preferences = {
                    emailNotifications: emailNotif == 1 ? true : false,
                    autoSaveHistory: autoSave == 1 ? true : false
                };

                console.log('Final preferences:', preferences);
                return json(res, { ok: true, preferences });
            } else {
                return json(res, {
                    ok: true,
                    preferences: { emailNotifications: true, autoSaveHistory: true }
                });
            }

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Erreur récupération préférences:', error);
        return json(res, { error: 'Erreur serveur' }, 500);
    }
});

// Supprimer le compte utilisateur
router.delete('/delete', async (req, res) => {
    try {
        const user = await requireUser(req);
        const connection = await pool.getConnection();

        try {
            // Supprimer l'utilisateur (CASCADE supprimera les données liées)
            await connection.execute('DELETE FROM users WHERE id = ?', [user.id]);

            return json(res, { ok: true, message: 'Compte supprimé avec succès' });

        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Erreur suppression compte:', error);
        return json(res, { error: error.message || 'Erreur serveur' }, 500);
    }
});

module.exports = router;
