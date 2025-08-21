const express = require('express');
const router = express.Router();
const { requireUser, json } = require('../utils/auth-util');
const bcrypt = require('bcrypt');
const pool = require('../db/connection');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configuration multer pour l'upload d'images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/avatars/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `avatar-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format d\'image non supporté'), false);
    }
  }
});

// POST /api/user/avatar - Upload avatar
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const user = await requireUser(req);
    
    if (!req.file) {
      return json(res, { error: 'Aucun fichier fourni' }, 400);
    }

    const connection = await pool.getConnection();

    try {
      // Récupérer l'ancien avatar pour le supprimer
      const [oldAvatar] = await connection.execute(
        'SELECT avatar_path FROM users WHERE id = ?',
        [user.id]
      );

      // Supprimer l'ancien fichier si il existe
      if (oldAvatar.length > 0 && oldAvatar[0].avatar_path) {
        try {
          await fs.unlink(path.join('public', oldAvatar.avatar_path));
        } catch (error) {
          console.warn('Impossible de supprimer ancien avatar:', error);
        }
      }

      // Sauvegarder le nouveau chemin
      const avatarPath = `/avatars/${req.file.filename}`;
      await connection.execute(
        'UPDATE users SET avatar_path = ? WHERE id = ?',
        [avatarPath, user.id]
      );

      return json(res, {
        ok: true,
        avatar: {
          url: avatarPath,
          filename: req.file.filename
        }
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erreur upload avatar:', error);
    return json(res, { error: 'Erreur lors de l\'upload' }, 500);
  }
});

// GET /api/user/avatar - Récupérer avatar
router.get('/avatar', async (req, res) => {
  try {
    const user = await requireUser(req);
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        'SELECT avatar_path FROM users WHERE id = ?',
        [user.id]
      );

      if (rows.length > 0 && rows[0].avatar_path) {
        return json(res, {
          ok: true,
          avatar: {
            url: rows.avatar_path
          }
        });
      } else {
        return json(res, { ok: true, avatar: null });
      }

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erreur récupération avatar:', error);
    return json(res, { error: 'Erreur serveur' }, 500);
  }
});

// DELETE /api/user/avatar - Supprimer avatar
router.delete('/avatar', async (req, res) => {
  try {
    const user = await requireUser(req);
    const connection = await pool.getConnection();

    try {
      // Récupérer le chemin avant suppression
      const [rows] = await connection.execute(
        'SELECT avatar_path FROM users WHERE id = ?',
        [user.id]
      );

      // Supprimer le fichier
      if (rows.length > 0 && rows[0].avatar_path) {
        try {
          await fs.unlink(path.join('public', rows.avatar_path));
        } catch (error) {
          console.warn('Fichier avatar introuvable:', error);
        }
      }

      // Supprimer de la base
      await connection.execute(
        'UPDATE users SET avatar_path = NULL WHERE id = ?',
        [user.id]
      );

      return json(res, { ok: true });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erreur suppression avatar:', error);
    return json(res, { error: 'Erreur serveur' }, 500);
  }
});

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
