const express = require('express');
const router = express.Router();
const { json, setSession, createUser } = require("../utils/auth-util");
const { extractClientInfo, updateUserSignupInfo, logUserAccess } = require('../utils/client-info');
const pool = require('../db/connection');

router.post('/', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation des champs obligatoires
        if (!username || !email || !password) {
            return json(res, { error: "Tous les champs sont obligatoires" }, 400);
        }

        // Validation du pseudo
        if (username.length < 3 || username.length > 20) {
            return json(res, { error: "Le pseudo doit contenir entre 3 et 20 caractères" }, 400);
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return json(res, { error: "Le pseudo ne peut contenir que des lettres, chiffres et underscore" }, 400);
        }

        // Validation du mot de passe
        if (password.length < 8) {
            return json(res, { error: "Mot de passe trop court (minimum 8 caractères)" }, 400);
        }

        // Créer l'utilisateur
        const user = await createUser(username, email, password);
        const cookie = setSession(user);

        // Capturer les infos client
        const clientInfo = extractClientInfo(req);
        
        // Mettre à jour les infos utilisateur à l'inscription
        updateUserSignupInfo(pool, user.id, clientInfo);
        
        // Logger l'inscription (optionnel)
        logUserAccess(pool, user.id, 'signup', clientInfo);

        res.setHeader('Set-Cookie', cookie);
        json(res, {
            ok: true,
            user: {
                username: user.username,
                email: user.email,
                plan: user.plan
            },
            message: "Compte créé avec succès !"
        });

    } catch (error) {
        console.error('Signup error:', error);
        json(res, { error: error.message || "Erreur lors de l'inscription" }, 400);
    }
});

module.exports = router;
