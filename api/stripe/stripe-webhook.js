const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../db/connection');

router.post('/', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    console.log('🔍 Debug webhook:');
    console.log('- Body type:', typeof req.body);
    console.log('- Body length:', req.body ? req.body.length : 'undefined');
    console.log('- Signature present:', sig ? 'YES' : 'NO');
    console.log('- Secret configured:', process.env.STRIPE_WEBHOOK_SECRET ? 'YES' : 'NO');

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        console.log('✅ Webhook signature vérifiée:', event.type);
    } catch (err) {
        console.error('❌ Erreur signature webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const connection = await pool.getConnection();

    try {
        console.log(`📨 Webhook reçu: ${event.type} | ID: ${event.id} | Created: ${new Date(event.created * 1000).toISOString()}`);
        
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                console.log('🎉 Checkout completed pour:', session.customer_email);

                if (session.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);

                    await connection.execute(`
                        UPDATE users SET 
                            plan = 'pro',
                            stripe_customer_id = ?,
                            stripe_subscription_id = ?,
                            subscription_status = 'active',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [
                        session.customer,
                        session.subscription,
                        session.metadata.user_id
                    ]);

                    console.log('✅ Utilisateur mis à niveau vers PRO:', session.metadata.user_id);
                }
                break;

            case 'customer.subscription.created':
                const createdSub = event.data.object;
                // Ne pas donner accès PRO tant qu'il n'y a pas eu de paiement
                await connection.execute(`
                    UPDATE users SET
                        stripe_subscription_id = ?,
                        subscription_status = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE stripe_customer_id = ?
                `, [createdSub.id, createdSub.status, createdSub.customer]);
                console.log('📝 Abonnement créé:', createdSub.id, 'Status:', createdSub.status);
                break;

            case 'customer.subscription.updated':
                const updatedSub = event.data.object;

                // ✅ Validation : vérifier que l'abonnement existe en base
                const [existingUser] = await connection.execute(`
                    SELECT id FROM users WHERE stripe_subscription_id = ?
                `, [updatedSub.id]);

                if (existingUser.length === 0) {
                    console.warn('⚠️ Abonnement mis à jour mais utilisateur introuvable:', updatedSub.id);
                    break;
                }

                await connection.execute(`
                    UPDATE users SET
                        subscription_status = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE stripe_subscription_id = ?
                `, [updatedSub.status, updatedSub.id]);

                // Logique du plan selon le status
                if (updatedSub.status === 'active') {
                    await connection.execute(`UPDATE users SET plan = 'pro' WHERE stripe_subscription_id = ?`, [updatedSub.id]);
                } else if (['canceled', 'unpaid', 'past_due'].includes(updatedSub.status)) {
                    await connection.execute(`UPDATE users SET plan = 'free' WHERE stripe_subscription_id = ?`, [updatedSub.id]);
                }

                console.log('🔄 Abonnement mis à jour:', updatedSub.id, 'Nouveau status:', updatedSub.status);
                break;

            case 'customer.subscription.deleted':
                const deletedSub = event.data.object;

                await connection.execute(`
                    UPDATE users SET 
                        plan = 'free',
                        subscription_status = 'canceled',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE stripe_subscription_id = ?
                `, [deletedSub.id]);

                console.log('✅ Abonnement annulé:', deletedSub.id);
                break;

            case 'invoice.payment_succeeded':
                const paidInvoice = event.data.object;
                if (paidInvoice.subscription) {
                    await connection.execute(`
                        UPDATE users SET
                            subscription_status = 'active',
                            plan = 'pro',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE stripe_subscription_id = ?
                    `, [paidInvoice.subscription]);
                    console.log('💰 Paiement réussi pour abonnement:', paidInvoice.subscription);
                }
                break;

            case 'invoice.payment_failed':
                const failedInvoice = event.data.object;

                await connection.execute(`
                    UPDATE users SET 
                        subscription_status = 'past_due',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE stripe_subscription_id = ?
                `, [failedInvoice.subscription]);

                console.log('⚠️ Paiement échoué:', failedInvoice.subscription);
                break;

            case 'invoice.marked_uncollectible':
                const inv = event.data.object;
                await connection.execute(`
                    UPDATE users SET
                        subscription_status = 'uncollectible',
                        plan = 'free',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE stripe_subscription_id = ?
                `, [inv.subscription]);
                console.log('🚫 Facture irrécupérable, passage en free:', inv.subscription);
                break;

            default:
                console.log(`ℹ️ Événement non géré: ${event.type}`, {
                    id: event.id,
                    created: event.created,
                    object_id: event.data.object.id,
                    livemode: event.livemode
                });
        }

        // Toujours répondre 200 pour confirmer la réception
        res.status(200).json({ received: true });

    } catch (error) {
        console.error('❌ Erreur traitement webhook:', {
            event_type: event?.type,
            event_id: event?.id,
            error: error.message,
            stack: error.stack
        });

        // Ne pas renvoyer 500 pour éviter les retry Stripe inutiles
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            res.status(500).json({ error: 'Database error' });
        } else {
            res.status(200).json({ received: true, error: 'Processing error logged' });
        }
    } finally {
        connection.release();
    }
});

module.exports = router;
