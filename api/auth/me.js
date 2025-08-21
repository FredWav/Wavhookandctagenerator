const express = require('express');
const router = express.Router();
const { requireUser } = require("../utils/auth-util");

router.get('/', async (req, res) => {
    try {
        const user = await requireUser(req);
        res.json({ 
            ok: true, 
            user: { 
                email: user.email, 
                plan: user.plan,
                createdAt: user.createdAt 
            } 
        });

    } catch (error) {
        console.error('Me route error:', error);
        res.status(401).json({ error: "Non authentifié" });
    }
});

router.post('/logout', (req, res) => {
    const { clearSession, COOKIE_NAME } = require("../../utils/auth-util");
    const clearCookie = clearSession();
    
    res.setHeader('Set-Cookie', clearCookie);
    res.json({ ok: true, message: "Déconnecté" });
});

module.exports = router;
