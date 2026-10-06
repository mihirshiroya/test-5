const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authenticate, authorize, generalRateLimit } = require('../middleware/auth');
const { cacheResponse, invalidateOn } = require('../middleware/cache');

router.use(generalRateLimit);

router.use(authenticate);

// User lists/stats are shared admin data, so they use a global namespace
// (responses are still keyed per requester). Any user write invalidates it.
const USERS_NS = { name: 'users', global: true };
router.use(invalidateOn(USERS_NS));

// Session lists are not cached: they must reflect logins on other devices.
router.get('/me/sessions', UserController.getActiveSessions);
router.delete('/me/sessions/:sessionId', UserController.revokeSession);

router.get('/', authorize('ADMIN'), cacheResponse(USERS_NS, 60), UserController.getAllUsers);
router.get('/stats', authorize('ADMIN'), cacheResponse(USERS_NS, 60), UserController.getUserStats);
router.get('/:id', cacheResponse(USERS_NS, 60), UserController.getUserById);
router.put('/:id', UserController.updateUser);
router.delete('/:id', UserController.deleteUser);

router.patch('/:id/deactivate', authorize('ADMIN'), UserController.deactivateUser);
router.patch('/:id/activate', authorize('ADMIN'), UserController.activateUser);
router.patch('/:id/role', authorize('ADMIN'), UserController.updateUserRole);

module.exports = router;
