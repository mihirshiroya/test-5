const prisma = require('../config/database');
const { ContentType, NoteTint, NoteIcon } = require('@prisma/client');

// ---------------------------------------------------------------------------
// Constants & query shapes
// ---------------------------------------------------------------------------

// Single source of truth = the Prisma enums
const CONTENT_TYPES = ['text', 'code'];
const TINTS = ['blue', 'violet', 'pink', 'amber', 'emerald', 'rose', 'cyan', 'lime'];
const ICONS = ['folder', 'doc', 'image', 'star', 'work', 'heart', 'code', 'music', 'rocket', 'camera']
const ORDER = [{ position: 'asc' }, { createdAt: 'asc' }];

// Used for list views: folder fields + subtopic counts (to compute `items`)
const folderSelect = {
  id: true,
  title: true,
  tint: true,
  icon: true,
  updatedAt: true,
  topics: { select: { _count: { select: { subtopics: true } } } }
};

// Used for the full doc: topics -> subtopics -> content, all ordered
const docInclude = {
  topics: {
    orderBy: ORDER,
    include: {
      subtopics: {
        orderBy: ORDER,
        include: { content: { orderBy: ORDER } }
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const asArray = (v) => (Array.isArray(v) ? v : []);
const fail = (res, status, message) => res.status(status).json({ success: false, message });

const serverError = (res, label, error, message) => {
  console.error(`${label} error:`, error);
  return fail(res, 500, message);
};

// Ownership checks – every lookup is scoped to the logged-in user
const findOwnedNote = (id, userId) =>
  prisma.note.findFirst({ where: { id, userId }, select: { id: true } });

const findOwnedTopic = (id, userId) =>
  prisma.topic.findFirst({ where: { id, note: { userId } } });

const findOwnedSubtopic = (id, userId) =>
  prisma.subtopic.findFirst({
    where: { id, topic: { note: { userId } } },
    include: { topic: { select: { noteId: true } } }
  });

const findOwnedContent = (id, userId) =>
  prisma.content.findFirst({
    where: { id, subtopic: { topic: { note: { userId } } } },
    include: { subtopic: { select: { topic: { select: { noteId: true } } } } }
  });

// Next sibling position (append to the end)
async function nextPosition(model, where) {
  const { _max } = await prisma[model].aggregate({ where, _max: { position: true } });
  return (_max.position ?? -1) + 1;
}

// Bump the folder's updatedAt and return the fresh folder summary
// (so the client can update `items` and `updatedAt` in one go)
async function touchNote(noteId) {
  const note = await prisma.note.update({
    where: { id: noteId },
    data: { updatedAt: new Date() },
    select: folderSelect
  });
  return serializeFolder(note);
}

// Convert nested client data into a Prisma nested-create payload.
// Client-side ids are ignored; the DB generates its own.
function buildTopicsCreate(topics) {
  return asArray(topics).map((t, ti) => ({
    title: clean(t?.title) || 'Untitled topic',
    position: ti,
    subtopics: {
      create: asArray(t?.subtopics).map((s, si) => ({
        title: clean(s?.title) || 'Untitled subtopic',
        description: clean(s?.description) || null,
        position: si,
        content: {
          create: asArray(s?.content).map((c, ci) => ({
            title: clean(c?.title) || null,
            type: CONTENT_TYPES.includes(c?.type) ? c.type : 'text',
            content: typeof c?.content === 'string' ? c.content : '',
            language: clean(c?.language) || null,
            position: ci
          }))
        }
      }))
    }
  }));
}

// ---------------------------------------------------------------------------
// Serializers – shape responses exactly like the frontend types
// (updatedAt as a millisecond timestamp, null -> omitted)
// ---------------------------------------------------------------------------

const countItems = (topics = []) =>
  topics.reduce((sum, t) => sum + (t._count?.subtopics ?? t.subtopics?.length ?? 0), 0);

const serializeFolder = (note) => ({
  id: note.id,
  title: note.title,
  description: note.description ?? undefined,
  tint: note.tint,
  icon: note.icon,
  items: countItems(note.topics),
  updatedAt: note.updatedAt.getTime()
});

const serializeContent = (c) => ({
  id: c.id,
  title: c.title ?? undefined,
  type: c.type,
  content: c.content,
  language: c.language ?? undefined
});

const serializeSubtopic = (s) => ({
  id: s.id,
  title: s.title,
  description: s.description ?? undefined,
  content: asArray(s.content).map(serializeContent)
});

const serializeTopic = (t) => ({
  id: t.id,
  title: t.title,
  subtopics: asArray(t.subtopics).map(serializeSubtopic)
});

const serializeDoc = (note) => ({ topics: asArray(note.topics).map(serializeTopic) });

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

class NotesController {
  // ============================ FOLDERS (Note) ============================

  // GET /api/notes
  static async getNotes(req, res) {
    try {
      const notes = await prisma.note.findMany({
        where: { userId: req.user.id },
        select: folderSelect,
        orderBy: { updatedAt: 'desc' }
      });

      res.json({
        success: true,
        data: { folders: notes.map(serializeFolder) }
      });
    } catch (error) {
      return serverError(res, 'Get notes', error, 'Failed to fetch notes');
    }
  }

  // GET /api/notes/:noteId   (folder + full doc)
  static async getNoteById(req, res) {
    try {
      const { noteId } = req.params;

      const note = await prisma.note.findFirst({
        where: { id: noteId, userId: req.user.id },
        include: docInclude
      });

      if (!note) return fail(res, 404, 'Note not found');

      res.json({
        success: true,
        data: { folder: serializeFolder(note), doc: serializeDoc(note) }
      });
    } catch (error) {
      return serverError(res, 'Get note by ID', error, 'Failed to fetch note');
    }
  }

  // POST /api/notes   body: { name, tint?, icon?, description?, topics? }
  // `topics` is optional – lets you import a whole doc in one request
  static async createNote(req, res) {
    try {
      const { tint, icon, topics } = req.body;
      const title = clean(req.body.title);

      if (!title) return fail(res, 400, 'Name is required');
      if (tint !== undefined && !TINTS.includes(tint)) {
        return fail(res, 400, `tint must be one of: ${TINTS.join(', ')}`);
      }
      if (icon !== undefined && !ICONS.includes(icon)) {
        return fail(res, 400, `icon must be one of: ${ICONS.join(', ')}`);
      }
      if (topics !== undefined && !Array.isArray(topics)) {
        return fail(res, 400, 'topics must be an array');
      }

      const note = await prisma.note.create({
        data: {
          userId: req.user.id,
          title,
          tint, // undefined -> DB default (blue)
          icon, // undefined -> DB default (folder)
          topics: { create: buildTopicsCreate(topics) }
        },
        include: docInclude
      });

      res.status(201).json({
        success: true,
        message: 'Note created successfully',
        data: { folder: serializeFolder(note), doc: serializeDoc(note) }
      });
    } catch (error) {
      return serverError(res, 'Create note', error, 'Failed to create note');
    }
  }

  // PATCH /api/notes/:noteId   body: { name?, tint?, icon?, description? }
  static async updateNote(req, res) {
    try {
      const { noteId } = req.params;
      const data = {};

      if (req.body.title !== undefined) {
        const title = clean(req.body.title);
        if (!title) return fail(res, 400, 'name cannot be empty');
        data.title = title;
      }
      if (req.body.tint !== undefined) {
        if (!TINTS.includes(req.body.tint)) {
          return fail(res, 400, `tint must be one of: ${TINTS.join(', ')}`);
        }
        data.tint = req.body.tint;
      }
      if (req.body.icon !== undefined) {
        if (!ICONS.includes(req.body.icon)) {
          return fail(res, 400, `icon must be one of: ${ICONS.join(', ')}`);
        }
        data.icon = req.body.icon;
      }
      if (Object.keys(data).length === 0) {
        return fail(res, 400, 'No valid fields to update');
      }

      if (!(await findOwnedNote(noteId, req.user.id))) {
        return fail(res, 404, 'Note not found');
      }

      const note = await prisma.note.update({
        where: { id: noteId },
        data,
        select: folderSelect
      });

      res.json({
        success: true,
        message: 'Note updated successfully',
        data: { folder: serializeFolder(note) }
      });
    } catch (error) {
      return serverError(res, 'Update note', error, 'Failed to update note');
    }
  }

  // DELETE /api/notes/:noteId   (cascades to topics/subtopics/content)
  static async deleteNote(req, res) {
    try {
      const { noteId } = req.params;

      if (!(await findOwnedNote(noteId, req.user.id))) {
        return fail(res, 404, 'Note not found');
      }

      await prisma.note.delete({ where: { id: noteId } });

      res.json({ success: true, message: 'Note deleted successfully' });
    } catch (error) {
      return serverError(res, 'Delete note', error, 'Failed to delete note');
    }
  }

  // PUT /api/notes/:noteId/doc   body: { doc: { topics: [...] } }
  // Replaces the whole content tree (used by setDoc on the frontend)
  static async replaceDoc(req, res) {
    try {
      const { noteId } = req.params;
      const { doc } = req.body;

      if (!doc || !Array.isArray(doc.topics)) {
        return fail(res, 400, 'doc.topics must be an array');
      }
      if (!(await findOwnedNote(noteId, req.user.id))) {
        return fail(res, 404, 'Note not found');
      }

      const [, note] = await prisma.$transaction([
        prisma.topic.deleteMany({ where: { noteId } }),
        prisma.note.update({
          where: { id: noteId },
          data: { updatedAt: new Date(), topics: { create: buildTopicsCreate(doc.topics) } },
          include: docInclude
        })
      ]);

      res.json({
        success: true,
        message: 'Doc saved successfully',
        data: { folder: serializeFolder(note), doc: serializeDoc(note) }
      });
    } catch (error) {
      return serverError(res, 'Replace doc', error, 'Failed to save doc');
    }
  }

  // ================================ TOPICS ================================

  // POST /api/notes/:noteId/topics   body: { title }
  static async addTopic(req, res) {
    try {
      const { noteId } = req.params;
      const title = clean(req.body.title);

      if (!title) return fail(res, 400, 'Title is required');
      if (!(await findOwnedNote(noteId, req.user.id))) {
        return fail(res, 404, 'Note not found');
      }

      const topic = await prisma.topic.create({
        data: { noteId, title, position: await nextPosition('topic', { noteId }) }
      });
      const folder = await touchNote(noteId);

      res.status(201).json({
        success: true,
        message: 'Topic added successfully',
        data: { topic: serializeTopic(topic), folder }
      });
    } catch (error) {
      return serverError(res, 'Add topic', error, 'Failed to add topic');
    }
  }

  // PATCH /api/notes/topics/:topicId   body: { title }
  static async updateTopic(req, res) {
    try {
      const { topicId } = req.params;
      const title = clean(req.body.title);

      if (!title) return fail(res, 400, 'Title is required');

      const existing = await findOwnedTopic(topicId, req.user.id);
      if (!existing) return fail(res, 404, 'Topic not found');

      const topic = await prisma.topic.update({ where: { id: topicId }, data: { title } });
      const folder = await touchNote(existing.noteId);

      res.json({
        success: true,
        message: 'Topic updated successfully',
        data: { topic: { id: topic.id, title: topic.title }, folder }
      });
    } catch (error) {
      return serverError(res, 'Update topic', error, 'Failed to update topic');
    }
  }

  // DELETE /api/notes/topics/:topicId
  static async deleteTopic(req, res) {
    try {
      const { topicId } = req.params;

      const existing = await findOwnedTopic(topicId, req.user.id);
      if (!existing) return fail(res, 404, 'Topic not found');

      await prisma.topic.delete({ where: { id: topicId } });
      const folder = await touchNote(existing.noteId);

      res.json({
        success: true,
        message: 'Topic deleted successfully',
        data: { folder }
      });
    } catch (error) {
      return serverError(res, 'Delete topic', error, 'Failed to delete topic');
    }
  }

  // ============================== SUBTOPICS ===============================

  // POST /api/notes/topics/:topicId/subtopics   body: { title, description? }
  static async addSubtopic(req, res) {
    try {
      const { topicId } = req.params;
      const title = clean(req.body.title);

      if (!title) return fail(res, 400, 'Title is required');

      const topic = await findOwnedTopic(topicId, req.user.id);
      if (!topic) return fail(res, 404, 'Topic not found');

      const subtopic = await prisma.subtopic.create({
        data: {
          topicId,
          title,
          description: clean(req.body.description) || null,
          position: await nextPosition('subtopic', { topicId })
        }
      });
      const folder = await touchNote(topic.noteId);

      res.status(201).json({
        success: true,
        message: 'Subtopic added successfully',
        data: { subtopic: serializeSubtopic(subtopic), folder }
      });
    } catch (error) {
      return serverError(res, 'Add subtopic', error, 'Failed to add subtopic');
    }
  }

  // PATCH /api/notes/subtopics/:subtopicId   body: { title?, description? }
  static async updateSubtopic(req, res) {
    try {
      const { subtopicId } = req.params;
      const data = {};

      if (req.body.title !== undefined) {
        const title = clean(req.body.title);
        if (!title) return fail(res, 400, 'Title cannot be empty');
        data.title = title;
      }
      if (req.body.description !== undefined) {
        data.description = clean(req.body.description) || null;
      }
      if (Object.keys(data).length === 0) {
        return fail(res, 400, 'No valid fields to update');
      }

      const existing = await findOwnedSubtopic(subtopicId, req.user.id);
      if (!existing) return fail(res, 404, 'Subtopic not found');

      const subtopic = await prisma.subtopic.update({ where: { id: subtopicId }, data });
      const folder = await touchNote(existing.topic.noteId);

      res.json({
        success: true,
        message: 'Subtopic updated successfully',
        data: {
          subtopic: {
            id: subtopic.id,
            title: subtopic.title,
            description: subtopic.description ?? undefined
          },
          folder
        }
      });
    } catch (error) {
      return serverError(res, 'Update subtopic', error, 'Failed to update subtopic');
    }
  }

  // DELETE /api/notes/subtopics/:subtopicId
  static async deleteSubtopic(req, res) {
    try {
      const { subtopicId } = req.params;

      const existing = await findOwnedSubtopic(subtopicId, req.user.id);
      if (!existing) return fail(res, 404, 'Subtopic not found');

      await prisma.subtopic.delete({ where: { id: subtopicId } });
      const folder = await touchNote(existing.topic.noteId);

      res.json({
        success: true,
        message: 'Subtopic deleted successfully',
        data: { folder }
      });
    } catch (error) {
      return serverError(res, 'Delete subtopic', error, 'Failed to delete subtopic');
    }
  }

  // =============================== CONTENT ================================

  // POST /api/notes/subtopics/:subtopicId/content
  // body: { title?, type: 'text' | 'code', content, language? }
  static async addContent(req, res) {
    try {
      const { subtopicId } = req.params;
      const { title, type = 'text', content = '', language } = req.body;

      if (!CONTENT_TYPES.includes(type)) {
        return fail(res, 400, `type must be one of: ${CONTENT_TYPES.join(', ')}`);
      }
      if (typeof content !== 'string') return fail(res, 400, 'content must be a string');

      const subtopic = await findOwnedSubtopic(subtopicId, req.user.id);
      if (!subtopic) return fail(res, 404, 'Subtopic not found');

      const created = await prisma.content.create({
        data: {
          subtopicId,
          title: clean(title) || null,
          type,
          content,
          language: clean(language) || null,
          position: await nextPosition('content', { subtopicId })
        }
      });
      const folder = await touchNote(subtopic.topic.noteId);

      res.status(201).json({
        success: true,
        message: 'Content added successfully',
        data: { content: serializeContent(created), folder }
      });
    } catch (error) {
      return serverError(res, 'Add content', error, 'Failed to add content');
    }
  }

  // PATCH /api/notes/content/:contentId   body: { title?, type?, content?, language? }
  static async updateContent(req, res) {
    try {
      const { contentId } = req.params;
      const data = {};

      if (req.body.type !== undefined) {
        if (!CONTENT_TYPES.includes(req.body.type)) {
          return fail(res, 400, `type must be one of: ${CONTENT_TYPES.join(', ')}`);
        }
        data.type = req.body.type;
      }
      if (req.body.content !== undefined) {
        if (typeof req.body.content !== 'string') {
          return fail(res, 400, 'content must be a string');
        }
        data.content = req.body.content;
      }
      if (req.body.title !== undefined) data.title = clean(req.body.title) || null;
      if (req.body.language !== undefined) data.language = clean(req.body.language) || null;

      if (Object.keys(data).length === 0) {
        return fail(res, 400, 'No valid fields to update');
      }

      const existing = await findOwnedContent(contentId, req.user.id);
      if (!existing) return fail(res, 404, 'Content not found');

      const updated = await prisma.content.update({ where: { id: contentId }, data });
      const folder = await touchNote(existing.subtopic.topic.noteId);

      res.json({
        success: true,
        message: 'Content updated successfully',
        data: { content: serializeContent(updated), folder }
      });
    } catch (error) {
      return serverError(res, 'Update content', error, 'Failed to update content');
    }
  }

  // DELETE /api/notes/content/:contentId
  static async deleteContent(req, res) {
    try {
      const { contentId } = req.params;

      const existing = await findOwnedContent(contentId, req.user.id);
      if (!existing) return fail(res, 404, 'Content not found');

      await prisma.content.delete({ where: { id: contentId } });
      const folder = await touchNote(existing.subtopic.topic.noteId);

      res.json({
        success: true,
        message: 'Content deleted successfully',
        data: { folder }
      });
    } catch (error) {
      return serverError(res, 'Delete content', error, 'Failed to delete content');
    }
  }
}

module.exports = NotesController;