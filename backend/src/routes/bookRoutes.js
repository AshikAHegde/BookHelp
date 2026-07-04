const express = require('express');

const { getSubjects } = require('../controllers/bookController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /books/subjects — protected, returns subjects for the logged-in user's standard
router.get('/subjects', protect, getSubjects);

module.exports = router;
