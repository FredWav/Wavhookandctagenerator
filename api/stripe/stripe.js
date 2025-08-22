const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { requireUser, json } = require('../utils/auth-util');

// Configuration des plans
const PLANS_CONFIG = {
  plus: {
    name: 'Plus',
    stripe_price_id: 'price_1RyrESL3PzgBzdCeSIMQ3lMG', // Remplace par ton price_id Plus
    level: 1
  },
  pro: {
    name: 'Pro', 
    stripe_price_id: 'price_1RyfNGL3PzgBzdCeXt8Dpcs8', // Remplace par ton price_id Pro
    level: 2
  }
};

// Créer une session de checkout
router.post('/create-checkout-session', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { plan } = req.body; // 'plus' ou 'pro'
    
    // Validation du plan demandé
    if (!plan || !PLANS_CONFIG[plan]) {
      return json(res, { error: 'Plan invalide. Choisissez "plus" ou "pro".' }, 400);
    }

    const requestedPlan = PLANS_CONFIG[plan];
    const currentPlanLevel = user.plan === 'free' ? 0 : (PLANS_CONFIG[user.plan]?.level || 0);

    // Vérifier si l'utilisateur peut upgrader vers ce plan
    if (currentPlanLevel >= requestedPlan.level) {
      const message = currentPlanLevel === requestedPlan.level 
        ? `Vous êtes déjà abonné au plan ${requestedPlan.name}`
        : `Vous avez déjà un plan supérieur. Utilisez le portail client pour modifier votre abonnement.`;
      return json(res, { error: message }, 400);
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [{
        price: requestedPlan.stripe_price_id,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/upgrade?upgrade=success&plan=${plan}`,
      cancel_url: `${process.env.FRONTEND_URL}/upgrade?upgrade=canceled`,
      metadata: {
        user_id: user.id.toString(),
        user_email: user.email,
        plan: plan
      }
    });

    return json(res, { 
      ok: true, 
      checkout_url: session.url,
      plan: plan
    });

  } catch (error) {
    console.error('Erreur création session:', error);
    return json(res, { error: 'Erreur lors de la création de la session' }, 500);
  }
});

// Créer un portail client pour gérer l'abonnement
router.post('/create-portal-session', async (req, res) => {
  try {
    const user = await requireUser(req);
    
    /*console.log('🔍 Debug portail client:');
    console.log('User plan:', user.plan);
    console.log('User stripe_customer_id:', user.stripe_customer_id);*/
    
    // Vérifier si l'utilisateur a un plan payant
    if (user.plan === 'free') {
      console.log('❌ Utilisateur en plan gratuit');
      return json(res, { error: 'Vous devez avoir un abonnement actif pour accéder au portail' }, 400);
    }

    if (!user.stripe_customer_id) {
      console.log('❌ Pas de customer_id Stripe');
      return json(res, { error: 'Aucun compte client Stripe trouvé. Contactez le support.' }, 400);
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/upgrade`,
    });

    // console.log('✅ Portail créé:', portalSession.url);

    return json(res, { 
      ok: true, 
      portal_url: portalSession.url 
    });

  } catch (error) {
    console.error('❌ Erreur création portail Stripe:', error);
    return json(res, { 
      error: 'Erreur lors de la création du portail client',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, 500);
  }
});


module.exports = router;
