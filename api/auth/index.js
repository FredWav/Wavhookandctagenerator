const express = require('express');
const router = express.Router();

// Sous-routes
router.use('/login', require('./login'));
router.use('/signup', require('./signup'));
router.use('/me', require('./me'));

module.exports = router;
