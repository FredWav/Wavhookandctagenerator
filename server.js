require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

require('./api/db/connection');

app.use('/api/stripe/webhook', express.raw({type: 'application/json'}), require('./api/stripe/stripe-webhook'));

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir les assets/public/ (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Servir les fichiers statiques à la racine (optionnel pour styles.css/app.js à la racine)
app.use(express.static(__dirname));

// Dynamique : lister tous les .html de la racine
const htmlFiles = fs
  .readdirSync(__dirname)
  .filter(f => f.endsWith('.html'));

htmlFiles.forEach(filename => {
  // Route : '/' si index.html, sinon '/nomfichier' sans .html
  const route = filename === 'index.html' ? '/' : `/${filename.replace('.html', '')}`;

  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, filename));
  });
});

// Routes API
app.use('/api/generate-ctas', require('./api/generate-ctas'));
app.use('/api/generate-hooks', require('./api/generate-hooks'));
//app.use('/api/analyze-video', require('./api/analyze-video'));
app.use('/api/save-analysis', require('./api/save-analysis'));
app.use('/api/history', require('./api/history'));
app.use('/api/auth', require('./api/auth'));
app.use('/api/user', require('./api/auth/user'));
app.use('/api/auth/change-password', require('./api/auth/change-password'));
app.use('/api/stripe', require('./api/stripe/stripe'));

// Test route
app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello from Express!',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Gestion des erreurs
app.use((error, req, res, next) => {
  console.error('Erreur serveur:', error);
  res.status(500).json({
    error: 'Erreur serveur interne',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
  console.log(`📄 Pages HTML auto-servies :`);
  htmlFiles.forEach(filename => {
    const route = filename === 'index.html' ? '/' : `/${filename.replace('.html', '')}`;
    console.log(`   - ${route} → ${filename}`);
  });
  console.log(`🎨 Assets CSS/JS servis depuis /public/`);
  console.log(`🔌 APIs : /api/*`);
});
