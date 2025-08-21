const crypto = require("crypto");
const bcrypt = require('bcrypt');
const pool = require('../db/connection');
const { sign, verify } = require("../_jwt");

const COOKIE_NAME = "wav_auth";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-please-super-secret";
const SALT_ROUNDS = 12;

// Adapter pour Express
function json(res, data, status = 200, headers = {}) {
    res.status(status);
    Object.keys(headers).forEach(key => {
        res.setHeader(key, headers[key]);
    });
    return res.json(data);
}

function getBody(req) {
    return Promise.resolve(req.body || {});
}

function sameSite() { return "Lax"; }

function cookie(opts) {
    const { name, value, days = 15, httpOnly = true, path = "/", secure = true } = opts;
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    return `${name}=${value}; Expires=${exp}; Path=${path}; ${secure ? "Secure;" : ""} ${httpOnly ? "HttpOnly;" : ""} SameSite=${sameSite()}`;
}

async function createUser(username, email, password) {
    const connection = await pool.getConnection();
    try {
        // Vérifier si l'email existe déjà
        const [existingEmail] = await connection.execute(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (existingEmail.length > 0) {
            throw new Error("Cette adresse email est déjà utilisée");
        }

        // Vérifier si le pseudo existe déjà
        const [existingUsername] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            [username.toLowerCase()]
        );

        if (existingUsername.length > 0) {
            throw new Error("Ce pseudo est déjà pris");
        }

        // Hasher le mot de passe
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Créer l'utilisateur
        const [result] = await connection.execute(
            'INSERT INTO users (username, email, password_hash, plan) VALUES (?, ?, ?, ?)',
            [username.toLowerCase(), email.toLowerCase(), passwordHash, 'free']
        );

        const userId = result.insertId;

        // Créer les préférences par défaut
        await connection.execute(`
      INSERT INTO user_preferences (user_id, email_notifications, auto_save_history)
      VALUES (?, 1, 1)
    `, [userId]);

        // Récupérer l'utilisateur créé
        const [users] = await connection.execute(
            'SELECT id, username, email, plan, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            throw new Error("Utilisateur non trouvé après création");
        }

        const user = users[0];
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            plan: user.plan,
            createdAt: user.created_at ? new Date(user.created_at).getTime() : null
        };
    } finally {
        connection.release();
    }
}

async function verifyUser(email, password) {
    const connection = await pool.getConnection();
    try {
        const [users] = await connection.execute(
            'SELECT id, username, email, password_hash, plan, created_at FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (users.length === 0) {
            throw new Error("Utilisateur introuvable");
        }

        const user = users[0];
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            throw new Error("Mot de passe invalide");
        }

        return {
            id: user.id,
            username: user.username,
            email: user.email,
            plan: user.plan,
            createdAt: user.created_at.getTime()
        };
    } finally {
        connection.release();
    }
}

async function getUserById(userId) {
    const connection = await pool.getConnection();
    try {
        const [users] = await connection.execute(
            'SELECT id, username, email, plan, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return null;
        }

        const user = users[0];
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            plan: user.plan,
            createdAt: user.created_at.getTime()
        };
    } finally {
        connection.release();
    }
}

function setSession(user) {
    const token = sign({
        sub: user.id,
        email: user.email,
        plan: user.plan
    }, JWT_SECRET);
    const c = cookie({ name: COOKIE_NAME, value: token });
    return c;
}

function clearSession() {
    return `${COOKIE_NAME}=; Expires=${new Date(0).toUTCString()}; Path=/; HttpOnly; SameSite=${sameSite()}; Secure`;
}

function getTokenFromCookie(req) {
    const raw = req.headers.cookie || "";
    const m = raw.match(/(?:^|;\s*)wav_auth=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
}

async function requireUser(req) {
    const token = getTokenFromCookie(req);
    if (!token) throw new Error("Not authenticated");

    const payload = verify(token, JWT_SECRET);
    const user = await getUserById(payload.sub);

    if (!user) throw new Error("User missing");
    return user;
}

module.exports = {
    json,
    getBody,
    COOKIE_NAME,
    setSession,
    clearSession,
    requireUser,
    createUser,
    verifyUser,
    getUserById
};
