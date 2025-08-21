const express = require('express');
const router = express.Router();
const { requireUser, json } = require('./utils/auth-util');
const pool = require('./db/connection');

// GET /api/history - Récupérer l'historique utilisateur
router.get('/', async (req, res) => {
  try {
    const user = await requireUser(req);
    const connection = await pool.getConnection();
    
    try {
      // Limiter selon le plan (Free: 30 derniers, Pro: tous)
      const limit = user.plan === 'pro' ? '' : 'LIMIT 30';
      
      const [rows] = await connection.execute(`
        SELECT id, type, theme, platform, tone, niche, brief, results, created_at
        FROM user_history 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        ${limit}
      `, [user.id]);

      const history = rows.map(row => ({
        id: row.id,
        type: row.type,
        theme: row.theme,
        platform: row.platform,
        tone: row.tone,
        niche: row.niche,
        brief: row.brief,
        results: JSON.parse(row.results || '[]'),
        createdAt: row.created_at
      }));

      return json(res, { ok: true, history });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erreur historique:', error);
    return json(res, { error: error.message || 'Non authentifié' }, 401);
  }
});

// POST /api/history - Ajouter une entrée dans l'historique
router.post('/', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { type, theme, platform, tone, niche, brief, results } = req.body;
    
    const connection = await pool.getConnection();
    
    try {
      await connection.execute(`
        INSERT INTO user_history (user_id, type, theme, platform, tone, niche, brief, results)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        user.id,
        type,
        theme || null,
        platform || null,
        tone || null,
        niche || null,
        brief || null,
        JSON.stringify(results || [])
      ]);

      // Nettoyer l'historique pour les comptes gratuits (garder les 30 derniers)
      if (user.plan !== 'pro') {
        await connection.execute(`
          DELETE FROM user_history 
          WHERE user_id = ? 
          AND id NOT IN (
            SELECT id FROM (
              SELECT id FROM user_history 
              WHERE user_id = ? 
              ORDER BY created_at DESC 
              LIMIT 30
            ) AS recent
          )
        `, [user.id, user.id]);
      }

      return json(res, { ok: true, message: 'Ajouté à l\'historique' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erreur ajout historique:', error);
    return json(res, { error: 'Erreur lors de l\'ajout' }, 500);
  }
});

// DELETE /api/history - Vider tout l'historique
router.delete('/', async (req, res) => {
  try {
    const user = await requireUser(req);
    const connection = await pool.getConnection();
    
    try {
      await connection.execute('DELETE FROM user_history WHERE user_id = ?', [user.id]);
      return json(res, { ok: true, message: 'Historique vidé' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erreur suppression historique:', error);
    return json(res, { error: error.message || 'Erreur' }, 500);
  }
});

// DELETE /api/history/:id - Supprimer une entrée spécifique
router.delete('/:id', async (req, res) => {
  try {
    const user = await requireUser(req);
    const historyId = req.params.id;
    const connection = await pool.getConnection();
    
    try {
      const [result] = await connection.execute(
        'DELETE FROM user_history WHERE id = ? AND user_id = ?',
        [historyId, user.id]
      );

      if (result.affectedRows === 0) {
        return json(res, { error: 'Élément non trouvé' }, 404);
      }

      return json(res, { ok: true, message: 'Élément supprimé' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erreur suppression élément:', error);
    return json(res, { error: 'Erreur lors de la suppression' }, 500);
  }
});

module.exports = router;
