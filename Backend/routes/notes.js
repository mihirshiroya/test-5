const express = require('express');
const router = express.Router();
const NotesController = require('../controllers/notesController');
const { authenticate, generalRateLimit } = require('../middleware/auth');
const { cacheResponse, invalidateOn } = require('../middleware/cache');

router.use(generalRateLimit);

router.use(authenticate);
router.use(invalidateOn('notes'));

const cacheNotes = cacheResponse('notes', 300);

router.get('/', cacheNotes, NotesController.getNotes);
router.post('/', NotesController.createNote);

router.patch('/content/:contentId', NotesController.updateContent);
router.delete('/content/:contentId', NotesController.deleteContent);

router.post('/subtopics/:subtopicId/content', NotesController.addContent);
router.patch('/subtopics/:subtopicId', NotesController.updateSubtopic);
router.delete('/subtopics/:subtopicId', NotesController.deleteSubtopic);

router.post('/topics/:topicId/subtopics', NotesController.addSubtopic);
router.patch('/topics/:topicId', NotesController.updateTopic);
router.delete('/topics/:topicId', NotesController.deleteTopic);

router.get('/:noteId', cacheNotes, NotesController.getNoteById);
router.patch('/:noteId', NotesController.updateNote);
router.delete('/:noteId', NotesController.deleteNote);

router.put('/:noteId/doc', NotesController.replaceDoc);
router.post('/:noteId/topics', NotesController.addTopic);

module.exports = router;
