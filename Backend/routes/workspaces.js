const express = require('express');
const router = express.Router();
const WorkspacesController = require('../controllers/workspaceController');
const { authenticate, taskApiRateLimit } = require('../middleware/auth');

router.use(taskApiRateLimit);
router.use(authenticate);

// Collection
router.get('/', WorkspacesController.getWorkspaces);
router.post('/', WorkspacesController.createWorkspace);

// Single workspace
router.get('/:workspaceId', WorkspacesController.getWorkspaceById);
router.patch('/:workspaceId', WorkspacesController.updateWorkspace);
router.delete('/:workspaceId', WorkspacesController.deleteWorkspace);

module.exports = router;
