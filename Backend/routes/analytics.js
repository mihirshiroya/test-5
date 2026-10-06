const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { authenticate, taskApiRateLimit } = require('../middleware/auth');
const { cacheResponse } = require('../middleware/cache');

router.use(taskApiRateLimit);
router.use(authenticate);

// Analytics include "now"-relative values, so keep the TTL short; task and
// workspace writes also invalidate this namespace immediately.
const cacheAnalytics = cacheResponse('analytics', 30);

router.get('/overview', cacheAnalytics, AnalyticsController.getOverview);
router.get('/sessions', cacheAnalytics, AnalyticsController.getSessions);
router.get('/profile', cacheResponse('analytics', 120), AnalyticsController.getProfile);

module.exports = router;
