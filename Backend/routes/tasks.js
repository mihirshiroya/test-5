const express = require('express');
const router = express.Router();
const TasksController = require('../controllers/tasksController');
const { authenticate, taskApiRateLimit } = require('../middleware/auth');

const { cacheResponse, invalidateOn } = require('../middleware/cache');

router.use(taskApiRateLimit);
router.use(authenticate);
// Task writes change task lists, workspace contents and every analytics view.
router.use(invalidateOn('tasks', 'workspaces', 'analytics'));

const cacheTasks = cacheResponse('tasks', 120);

// Collection
router.get('/', cacheTasks, TasksController.getTasks);
router.post('/', TasksController.createTask);

// Static segments first
router.patch('/reorder', TasksController.reorderTasks);
router.get('/today', cacheResponse('tasks', 60), TasksController.getTodayTasks);

// Lifecycle
router.post('/:taskId/start', TasksController.startTask);
router.post('/:taskId/hold', TasksController.holdTask);
router.post('/:taskId/complete', TasksController.completeTask);
router.post('/:taskId/sync', TasksController.syncTime);
router.patch('/:taskId/move', TasksController.moveTask);

// Single task
router.get('/:taskId', cacheTasks, TasksController.getTaskById);
router.patch('/:taskId', TasksController.updateTask);
router.delete('/:taskId', TasksController.deleteTask);

module.exports = router;
