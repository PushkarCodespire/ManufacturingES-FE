import { useAuth } from '../context/AuthContext';

// Roles that bypass all permission checks
const ADMIN_ROLES = ['plant_head', 'it_admin'];

/**
 * usePermissions()
 *
 * Returns helpers to check the current user's feature-level permissions.
 * Permission keys are the same flat strings stored in user.permissions in the DB
 * (the checked keys from the Employee Detail → Access Tabs trees).
 *
 * Usage:
 *   const { can, canAny, canAll, isAdmin } = usePermissions();
 *
 *   if (can('sites-configuration-read'))       { ... }
 *   if (canAny(['store-requests-material_request-read', 'store-approval-request_approval-read'])) { ... }
 *
 * Admin roles (plant_head, it_admin) always return true for every check.
 */
const usePermissions = () => {
  const { user } = useAuth();

  // Login response sends role as lowercase key: user.role (not user.Role)
  const roleName = user?.role?.name;
  const isAdmin  = ADMIN_ROLES.includes(roleName);
  const perms    = user?.permissions ?? [];

  /**
   * can('some-permission-key')
   * True when the user has been explicitly granted this single key,
   * OR the user is an admin.
   */
  const can = (key) => isAdmin || perms.includes(key);

  /**
   * canAny(['key-a', 'key-b'])
   * True when the user has at least one of the given keys, or is admin.
   */
  const canAny = (keys = []) => isAdmin || keys.some((k) => perms.includes(k));

  /**
   * canAll(['key-a', 'key-b'])
   * True when the user has ALL of the given keys, or is admin.
   */
  const canAll = (keys = []) => isAdmin || keys.every((k) => perms.includes(k));

  return { can, canAny, canAll, isAdmin, permissions: perms };
};

/**
 * usePagePermissions(moduleKey)
 *
 * Centralized hook for page-level permission checks.
 * Call once per page with the module's base permission key.
 *
 * Usage:
 *   const { canRead, canWrite, canDownload } = usePagePermissions('sites-configuration');
 *   const { canRead, canWrite } = usePagePermissions('sites-shifts___leaves');
 *
 * Returns:
 *   canRead     — user has `{moduleKey}-read` (or is admin)
 *   canWrite    — user has `{moduleKey}-create_edit_delete` (or is admin)
 *   canDownload — user has `{moduleKey}-download` (or is admin)
 */
export const usePagePermissions = (moduleKey) => {
  const { can } = usePermissions();
  return {
    canRead:     can(`${moduleKey}-read`),
    canWrite:    can(`${moduleKey}-create_edit_delete`),
    canDownload: can(`${moduleKey}-download`),
  };
};

export default usePermissions;
