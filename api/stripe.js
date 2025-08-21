const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { requireUser, json } = require('./utils/auth-util');

// Créer une session de checkout
router.post('/create-checkout-session', async (req, res) => {
  try {
    const user = await requireUser(req);
    
    if (user.plan === 'pro') {
      return json(res, { error: 'Vous êtes déjà abonné au plan PRO' }, 400);
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [{
        price: 'price_1RyfNGL3PzgBzdCeXt8Dpcs8', // ← Remplace par ton price_id
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/profile?upgrade=success`,
      cancel_url: `${process.env.FRONTEND_URL}/profile?upgrade=canceled`,
      metadata: {
        user_id: user.id.toString(),
        user_email: user.email
      }
    });

    return json(res, { 
      ok: true, 
      checkout_url: session.url 
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
    
    console.log('🔍 Debug portail client:');
    console.log('User plan:', user.plan);
    console.log('User stripe_customer_id:', user.stripe_customer_id);
    
    if (user.plan !== 'pro') {
      console.log('❌ Utilisateur pas PRO');
      return json(res, { error: 'Vous devez être abonné au plan PRO pour accéder au portail' }, 400);
    }

    if (!user.stripe_customer_id) {
      console.log('❌ Pas de customer_id Stripe');
      return json(res, { error: 'Aucun compte client Stripe trouvé. Contactez le support.' }, 400);
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/profile`,
    });

    console.log('✅ Portail créé:', portalSession.url);

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
