const express = require('express');
const router = express.Router();
const TasksController = require('../controllers/tasksController');
const { authenticate, taskApiRateLimit } = require('../middleware/auth');

router.use(taskApiRateLimit);
router.use(authenticate);

// Collection
router.get('/', TasksController.getTasks);
router.post('/', TasksController.createTask);

// Static segments first
router.patch('/reorder', TasksController.reorderTasks);
router.get('/today', TasksController.getTodayTasks);

// Lifecycle
router.post('/:taskId/start', TasksController.startTask);
router.post('/:taskId/hold', TasksController.holdTask);
router.post('/:taskId/complete', TasksController.completeTask);
router.post('/:taskId/sync', TasksController.syncTime);
router.patch('/:taskId/move', TasksController.moveTask);

// Single task
router.get('/:taskId', TasksController.getTaskById);
router.patch('/:taskId', TasksController.updateTask);
router.delete('/:taskId', TasksController.deleteTask);

module.exports = router;
