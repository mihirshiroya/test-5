const express = require('express');
const router = express.Router();
const WorkspacesController = require('../controllers/workspaceController');
const { authenticate, taskApiRateLimit } = require('../middleware/auth');

const { cacheResponse, invalidateOn } = require('../middleware/cache');

router.use(taskApiRateLimit);
router.use(authenticate);
// Deleting/renaming a workspace also affects its tasks and analytics.
router.use(invalidateOn('workspaces', 'tasks', 'analytics'));

const cacheWorkspaces = cacheResponse('workspaces', 300);

// Collection
router.get('/', cacheWorkspaces, WorkspacesController.getWorkspaces);
router.post('/', WorkspacesController.createWorkspace);

// Single workspace
router.get('/:workspaceId', cacheWorkspaces, WorkspacesController.getWorkspaceById);
router.patch('/:workspaceId', WorkspacesController.updateWorkspace);
router.delete('/:workspaceId', WorkspacesController.deleteWorkspace);

module.exports = router;
