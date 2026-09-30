const prisma = require('../config/database');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_NAME_LENGTH = 100;

// tint / icon are frontend keys (TintKey / IconKey in components/Ui/project-data).
// They are validated by shape only so new keys can be added on the frontend
// without a backend change.
const APPEARANCE_KEY = /^[a-z0-9_-]{1,30}$/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const fail = (res, status, message) => res.status(status).json({ success: false, message });

const serverError = (res, label, error, message) => {
  console.error(`${label} error:`, error);
  return fail(res, 500, message);
};

const ms = (date) => (date ? date.getTime() : null);

const serializeWorkspace = (ws) => ({
  id: ws.id,
  name: ws.name,
  description: ws.description ?? null,
  tint: ws.tint,
  icon: ws.icon,
  createdAt: ms(ws.createdAt),
  updatedAt: ms(ws.updatedAt),
});

/**
 * Returns { value } when valid, { error } when invalid.
 * `undefined` means "not provided" -> value undefined (DB default / unchanged).
 */
const parseAppearanceKey = (raw, label) => {
  if (raw === undefined) return { value: undefined };
  const value = clean(raw);
  if (!APPEARANCE_KEY.test(value)) {
    return { error: `${label} is invalid` };
  }
  return { value };
};

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

class WorkspacesController {
  // GET /api/workspaces
  static async getWorkspaces(req, res) {
    try {
      const workspaces = await prisma.workspace.findMany({
        where: { userId: req.user.id },
        orderBy: { name: 'asc' },
      });

      res.json({
        success: true,
        data: { workspaces: workspaces.map(serializeWorkspace) },
      });
    } catch (error) {
      return serverError(res, 'Get workspaces', error, 'Failed to fetch workspaces');
    }
  }

  // GET /api/workspaces/:workspaceId
  static async getWorkspaceById(req, res) {
    try {
      const workspace = await prisma.workspace.findFirst({
        where: { id: req.params.workspaceId, userId: req.user.id },
      });
      if (!workspace) return fail(res, 404, 'Workspace not found');

      const taskCount = await prisma.task.count({
        where: { workspaceId: workspace.id },
      });

      res.json({
        success: true,
        data: { workspace: serializeWorkspace(workspace), taskCount },
      });
    } catch (error) {
      return serverError(res, 'Get workspace by ID', error, 'Failed to fetch workspace');
    }
  }

  // POST /api/workspaces   body: { name, description?, tint?, icon? }
  static async createWorkspace(req, res) {
    try {
      const name = clean(req.body.name);
      if (!name) return fail(res, 400, 'Name is required');
      if (name.length > MAX_NAME_LENGTH) {
        return fail(res, 400, `Name must be at most ${MAX_NAME_LENGTH} characters`);
      }

      const description = req.body.description !== undefined
        ? clean(req.body.description)
        : null;

      const tint = parseAppearanceKey(req.body.tint, 'Tint');
      if (tint.error) return fail(res, 400, tint.error);

      const icon = parseAppearanceKey(req.body.icon, 'Icon');
      if (icon.error) return fail(res, 400, icon.error);

      const workspace = await prisma.workspace.create({
        data: {
          userId: req.user.id,
          name,
          description,
          // undefined -> Prisma falls back to the schema @default
          tint: tint.value,
          icon: icon.value,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Workspace created successfully',
        data: { workspace: serializeWorkspace(workspace) },
      });
    } catch (error) {
      return serverError(res, 'Create workspace', error, 'Failed to create workspace');
    }
  }

  // PATCH /api/workspaces/:workspaceId   body: { name?, description?, tint?, icon? }
  static async updateWorkspace(req, res) {
    try {
      const workspace = await prisma.workspace.findFirst({
        where: { id: req.params.workspaceId, userId: req.user.id },
      });
      if (!workspace) return fail(res, 404, 'Workspace not found');

      const data = {};

      if (req.body.name !== undefined) {
        const name = clean(req.body.name);
        if (!name) return fail(res, 400, 'Name cannot be empty');
        if (name.length > MAX_NAME_LENGTH) {
          return fail(res, 400, `Name must be at most ${MAX_NAME_LENGTH} characters`);
        }
        data.name = name;
      }

      if (req.body.description !== undefined) {
        data.description = req.body.description === null
          ? null
          : clean(req.body.description);
      }

      const tint = parseAppearanceKey(req.body.tint, 'Tint');
      if (tint.error) return fail(res, 400, tint.error);
      if (tint.value !== undefined) data.tint = tint.value;

      const icon = parseAppearanceKey(req.body.icon, 'Icon');
      if (icon.error) return fail(res, 400, icon.error);
      if (icon.value !== undefined) data.icon = icon.value;

      if (Object.keys(data).length === 0) {
        return fail(res, 400, 'No valid fields to update');
      }

      const updated = await prisma.workspace.update({
        where: { id: workspace.id },
        data,
      });

      res.json({
        success: true,
        message: 'Workspace updated successfully',
        data: { workspace: serializeWorkspace(updated) },
      });
    } catch (error) {
      return serverError(res, 'Update workspace', error, 'Failed to update workspace');
    }
  }

  // DELETE /api/workspaces/:workspaceId
  static async deleteWorkspace(req, res) {
    try {
      const workspace = await prisma.workspace.findFirst({
        where: { id: req.params.workspaceId, userId: req.user.id },
      });
      if (!workspace) return fail(res, 404, 'Workspace not found');

      // Prisma onDelete: Cascade handles task deletion
      await prisma.workspace.delete({ where: { id: workspace.id } });

      res.json({
        success: true,
        message: 'Workspace deleted successfully',
      });
    } catch (error) {
      return serverError(res, 'Delete workspace', error, 'Failed to delete workspace');
    }
  }
}

module.exports = WorkspacesController;