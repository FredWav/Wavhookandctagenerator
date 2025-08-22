const express = require('express');
const router = express.Router();
const { json, getBody, setSession, verifyUser } = require("../utils/auth-util");
const { extractClientInfo, updateUserLoginInfo, logUserAccess } = require('../utils/client-info');
const pool = require('../db/connection');

router.post('/', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Champs manquants" });
        }

        const user = await verifyUser(email, password);
        const cookie = setSession(user);
        
        // Capturer les infos client
        const clientInfo = extractClientInfo(req);
        
        // Mettre à jour les infos utilisateur au login
        updateUserLoginInfo(pool, user.id, clientInfo);
        
        // Logger l'accès (optionnel)
        logUserAccess(pool, user.id, 'login', clientInfo);

        res.setHeader('Set-Cookie', cookie);
        res.json({
            ok: true,
            user: {
                username: user.username,
                email: user.email,
                plan: user.plan
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        
        // Logger les tentatives de login échouées
        if (error.message !== 'Champs manquants') {
            try {
                const clientInfo = extractClientInfo(req);
                logUserAccess(pool, null, 'login_failed', clientInfo);
            } catch (logError) {
                // Ignore les erreurs de log
            }
        }
        
        res.status(401).json({ error: error.message || "Login failed" });
    }
});

module.exports = router;
