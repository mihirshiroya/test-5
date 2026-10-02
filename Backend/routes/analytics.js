const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { authenticate, taskApiRateLimit } = require('../middleware/auth');

router.use(taskApiRateLimit);
router.use(authenticate);

router.get('/overview', AnalyticsController.getOverview);
router.get('/sessions', AnalyticsController.getSessions);
router.get('/profile', AnalyticsController.getProfile);

module.exports = router;
