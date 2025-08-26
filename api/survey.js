// api/survey.js
const express = require('express');
const router = express.Router();
const { requireUser, json } = require('./utils/auth-util');
const pool = require('./db/connection');

// Middleware CORS
function corsHeaders(res) {
    const origin = process.env.CORS_ORIGIN || "*";
    res.set({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
}

router.options('/', (req, res) => {
    corsHeaders(res);
    res.json({ ok: true });
});

router.post('/', async (req, res) => {
    corsHeaders(res);

    try {
        // L'utilisateur doit être connecté
        const user = await requireUser(req);

        const {
            page,
            question,
            rating,
            comment = null,
            userAgent,
            timestamp
        } = req.body;

        // Validation
        if (!page || !question || !rating || rating < 1 || rating > 5) {
            return json(res, {
                error: 'Données manquantes ou invalides'
            }, 400);
        }

        // Récupérer l'IP de l'utilisateur
        const getClientIP = (req) => {
            return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                req.headers['x-real-ip'] ||
                req.headers['x-client-ip'] ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress ||
                req.ip ||
                'unknown';
        };

        const clientIP = getClientIP(req);

        // Enregistrer en base de données
        const connection = await pool.getConnection();
        try {
            await connection.execute(`
        INSERT INTO user_feedback (
          user_id, 
          page, 
          question, 
          rating, 
          comment, 
          user_agent,
          ip_address,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                user.id,
                page,
                question,
                parseInt(rating),
                comment,
                userAgent,
                clientIP,
                new Date(timestamp)
            ]);

            console.log(`✅ Feedback reçu: ${rating}/5 pour "${question}" par user ${user.id} (IP: ${clientIP})`);

            return json(res, {
                ok: true,
                message: 'Feedback enregistré avec succès'
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Erreur feedback:', error);

        if (error.message && error.message.includes('Not authenticated')) {
            return json(res, { error: 'Authentication required' }, 401);
        }

        return json(res, {
            error: 'Erreur serveur',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
        }, 500);
    }
});

router.get('/', async (req, res) => {
    corsHeaders(res);

    try {
        // Récupérer l'utilisateur (optionnel pour la vérification)
        let user = null;
        try {
            user = await requireUser(req);
        } catch (error) {
            // Si pas d'utilisateur connecté, on peut quand même afficher le sondage
            console.log('Utilisateur non connecté pour le sondage');
        }

        const questions = [
            "Comment évaluez-vous la qualité des résultats générés ?",
            "Les résultats correspondent-ils à vos attentes ?",
            "Recommanderiez-vous cet outil à un ami ?",
            "Quelle est votre satisfaction globale ?",
            "Les suggestions sont-elles utiles pour votre contenu ?",
            "L'interface est-elle intuitive et facile à utiliser ?",
            "Le temps de réponse vous semble-t-il satisfaisant ?",
            "Les résultats sont-ils suffisamment précis et pertinents ?",
            "L'outil répond-il à vos besoins spécifiques ?",
            "Dans quelle mesure ce service améliore-t-il votre productivité ?"
        ];

        let availableQuestions = [...questions];

        // Si utilisateur connecté, filtrer les questions déjà répondues
        if (user) {
            const connection = await pool.getConnection();
            try {
                const [answeredQuestions] = await connection.execute(`
                    SELECT DISTINCT question 
                    FROM user_feedback 
                    WHERE user_id = ?
                `, [user.id]);

                const answeredQuestionTexts = answeredQuestions.map(row => row.question);

                // Filtrer les questions non répondues
                availableQuestions = questions.filter(q =>
                    !answeredQuestionTexts.includes(q)
                );

                console.log(`👤 User ${user.id}: ${answeredQuestionTexts.length} questions répondues, ${availableQuestions.length} disponibles`);

            } finally {
                connection.release();
            }
        }

        // Si toutes les questions ont été répondues, ne pas afficher de sondage
        if (availableQuestions.length === 0) {
            return res.json({
                ok: true,
                noSurvey: true,
                message: "Toutes les questions ont déjà été répondues"
            });
        }

        // Sélectionner une question aléatoire parmi celles disponibles
        const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

        const surveyConfig = {
            question: randomQuestion,

            // Émojis/SVG configurables
            emojis: {
                title: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7931ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-heart-icon lucide-message-circle-heart"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M7.828 13.07A3 3 0 0 1 12 8.764a3 3 0 0 1 5.004 2.224 3 3 0 0 1-.832 2.083l-3.447 3.62a1 1 0 0 1-1.45-.001z"/></svg>`,
                heart: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ffee00ff" stroke="#ffd900ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-star-icon lucide-star"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>`,
                success: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7931ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>`,
                ratingLabels: {
                    0: "Cliquez pour noter",
                    1: "Très décevant 😞",
                    2: "Décevant 😐",
                    3: "Correct 🙂",
                    4: "Bien 😊",
                    5: "Excellent ! 🤩"
                }
            },

            // Textes configurables
            texts: {
                title: "Votre avis",
                skipButton: "Passer",
                submitButton: "Envoyer",
                successTitle: "Merci !",
                successMessage: "Votre avis nous aide à améliorer l'outil",
                placeholder: "Un commentaire ? (optionnel)"
            },

            // Configuration comportement
            behavior: {
                showProbability: 0.35, // 35% des chance
                showDelay: 20, // secondes après chargement de la page
                cooldownDays: 3, // 3 jours mini entre deux affichages
                skipCooldownDays: 10.5, // 1 semaine et demie
                closeCooldownHours: 12   // 12 heures
            },

            // Informations sur le progression
            progress: {
                answered: questions.length - availableQuestions.length,
                total: questions.length,
                remaining: availableQuestions.length
            }
        };

        res.json({
            ok: true,
            ...surveyConfig
        });

    } catch (error) {
        console.error('Erreur lors de la récupération du sondage:', error);

        res.json({
            ok: false,
            error: 'Erreur serveur',
        });
    }
});

module.exports = router;
