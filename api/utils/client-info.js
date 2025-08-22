// utils/client-info.js
const UAParser = require('ua-parser-js');

/**
 * Extrait les informations client et estime le timezone
 */
function extractClientInfo(req) {
    const parser = new UAParser(req.headers['user-agent']);
    const result = parser.getResult();
    
    // Récupération de l'IP
    const ip = req.headers['x-forwarded-for'] 
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.headers['x-real-ip'] 
        || req.connection.remoteAddress 
        || req.socket.remoteAddress 
        || 'unknown';

    // Parsing de la langue
    let primaryLanguage = null;
    let country = null;
    
    if (req.headers['accept-language']) {
        const languages = req.headers['accept-language'].split(',');
        const firstLang = languages[0].split(';');
        primaryLanguage = firstLang[0].toLowerCase();
        
        if (firstLang.includes('-')) {
            country = firstLang.split('-')[1].toUpperCase();
        }
    }

    // Estimation du timezone basée sur Accept-Language et IP
    const timezone = estimateTimezone(country, primaryLanguage);

    // Détection du type de device plus précise
    let deviceType = 'desktop';
    if (result.device.type) {
        deviceType = result.device.type;
    } else if (req.headers['user-agent']) {
        const ua = req.headers['user-agent'].toLowerCase();
        if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
            deviceType = 'mobile';
        } else if (ua.includes('tablet') || ua.includes('ipad')) {
            deviceType = 'tablet';
        }
    }

    return {
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || null,
        browser: result.browser.name ? `${result.browser.name} ${result.browser.version}` : null,
        os: result.os.name ? `${result.os.name} ${result.os.version}` : null,
        device: deviceType,
        primaryLanguage: primaryLanguage,
        country: country,
        timezone: timezone,
        fullAcceptLanguage: req.headers['accept-language'] || null,
        referer: req.headers['referer'] || null
    };
}

/**
 * Estime le timezone basé sur le pays et la langue
 */
function estimateTimezone(country, language) {
    const timezoneMap = {
        'FR': 'Europe/Paris',
        'GB': 'Europe/London', 
        'US': 'America/New_York',
        'CA': 'America/Toronto',
        'DE': 'Europe/Berlin',
        'ES': 'Europe/Madrid',
        'IT': 'Europe/Rome',
        'BE': 'Europe/Brussels',
        'CH': 'Europe/Zurich',
        'MA': 'Africa/Casablanca',
        'DZ': 'Africa/Algiers',
        'TN': 'Africa/Tunis'
    };
    
    return timezoneMap[country] || 'Europe/Paris'; // Default
}

/**
 * Met à jour les infos utilisateur lors du signup
 */
async function updateUserSignupInfo(pool, userId, clientInfo) {
    try {
        const connection = await pool.getConnection();
        try {
            await connection.execute(`
                UPDATE users SET 
                    country = ?, 
                    primary_language = ?,
                    timezone = ?,
                    preferred_browser = ?, 
                    preferred_os = ?,
                    preferred_device = ?,
                    signup_ip = ?,
                    signup_user_agent = ?,
                    signup_referer = ?,
                    last_login_ip = ?,
                    last_login_at = NOW(),
                    last_user_agent = ?,
                    total_logins = 1,
                    last_seen_at = NOW()
                WHERE id = ?
            `, [
                clientInfo.country,
                clientInfo.primaryLanguage,
                clientInfo.timezone,
                clientInfo.browser,
                clientInfo.os,
                clientInfo.device,
                clientInfo.ipAddress,
                clientInfo.userAgent,
                clientInfo.referer,
                clientInfo.ipAddress,
                clientInfo.userAgent,
                userId
            ]);

            console.log(`✅ Infos signup mises à jour pour user ${userId}`);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('❌ Erreur mise à jour signup info:', error);
    }
}

/**
 * Met à jour les infos utilisateur lors du login
 */
async function updateUserLoginInfo(pool, userId, clientInfo) {
    try {
        const connection = await pool.getConnection();
        try {
            await connection.execute(`
                UPDATE users SET 
                    last_login_ip = ?,
                    last_login_at = NOW(),
                    last_user_agent = ?,
                    total_logins = total_logins + 1,
                    last_seen_at = NOW(),
                    -- Mettre à jour les préférences si pas déjà définies
                    country = COALESCE(country, ?),
                    primary_language = COALESCE(primary_language, ?),
                    timezone = COALESCE(timezone, ?),
                    preferred_browser = COALESCE(preferred_browser, ?),
                    preferred_os = COALESCE(preferred_os, ?),
                    preferred_device = COALESCE(preferred_device, ?)
                WHERE id = ?
            `, [
                clientInfo.ipAddress,
                clientInfo.userAgent,
                clientInfo.country,
                clientInfo.primaryLanguage,
                clientInfo.timezone,
                clientInfo.browser,
                clientInfo.os,
                clientInfo.device,
                userId
            ]);

            console.log(`✅ Infos login mises à jour pour user ${userId}`);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('❌ Erreur mise à jour login info:', error);
    }
}

/**
 * Log d'accès dans la table séparée (optionnel)
 */
async function logUserAccess(pool, userId, action, clientInfo) {
    try {
        const connection = await pool.getConnection();
        try {
            await connection.execute(`
                INSERT INTO user_access_log 
                (user_id, action, ip_address, user_agent, browser, os, device, 
                 primary_language, country, full_accept_language, referer, access_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                userId,
                action,
                clientInfo.ipAddress,
                clientInfo.userAgent,
                clientInfo.browser,
                clientInfo.os,
                clientInfo.device,
                clientInfo.primaryLanguage,
                clientInfo.country,
                clientInfo.fullAcceptLanguage,
                clientInfo.referer
            ]);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('❌ Erreur log d\'accès:', error);
    }
}

module.exports = {
    extractClientInfo,
    updateUserSignupInfo,
    updateUserLoginInfo,
    logUserAccess
};
