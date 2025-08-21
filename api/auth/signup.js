const express = require('express');
const router = express.Router();
const { json, getBody, setSession, createUser } = require("../utils/auth-util");

router.post('/', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: "Champs manquants" });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "Mot de passe trop court (min 6 caractères)" });
        }

        const user = await createUser(email, password);
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
        console.error('Signup error:', error);
        res.status(400).json({ error: error.message || "Signup failed" });
    }
});

module.exports = router;
