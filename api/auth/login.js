const express = require('express');
const router = express.Router();
const { json, getBody, setSession, verifyUser } = require("../utils/auth-util");

router.post('/', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: "Champs manquants" });
        }

        const user = await verifyUser(email, password);
        const cookie = setSession(user);
        
        res.setHeader('Set-Cookie', cookie);
        res.json({ 
            ok: true, 
            user: { 
                email: user.email, 
                plan: user.plan 
            } 
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message || "Login failed" });
    }
});

module.exports = router;
