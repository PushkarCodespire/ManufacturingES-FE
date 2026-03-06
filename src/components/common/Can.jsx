import usePermissions from '../../hooks/usePermissions';

/**
 * <Can> — Permission Gate Component
 *
 * Renders children only when the current user has the required permission.
 * Admin roles (plant_head, it_admin) always pass through.
 *
 * Props:
 *   permission  {string}    – single permission key to check (can use this OR any/all)
 *   any         {string[]}  – pass if at least ONE of these keys is present
 *   all         {string[]}  – pass if ALL of these keys are present
 *   fallback    {ReactNode} – what to render when access is denied (default: null)
 *
 * Examples:
 *   // Show edit button only if user can create/edit sites config
 *   <Can permission="sites-configuration-create_edit_delete">
 *     <Button>Edit</Button>
 *   </Can>
 *
 *   // Show download if user has read OR download on stock ledger
 *   <Can any={['store-inventory-stock_ledger-read', 'store-inventory-stock_ledger-download']}>
 *     <DownloadButton />
 *   </Can>
 *
 *   // Show section only if user has both read and create on production forms
 *   <Can all={['production-production_forms-read', 'production-production_forms-create_edit_delete']}>
 *     <FormsSection />
 *   </Can>
 *
 *   // Render a disabled placeholder when access is denied
 *   <Can permission="plan-po-create_po-create_edit_delete" fallback={<DisabledButton />}>
 *     <CreatePOButton />
 *   </Can>
 */
const Can = ({ permission, any, all, fallback = null, children }) => {
  const { can, canAny, canAll } = usePermissions();

  let allowed = false;

  if (permission)       allowed = can(permission);
  else if (any?.length) allowed = canAny(any);
  else if (all?.length) allowed = canAll(all);
  else                  allowed = true; // no constraint specified → show

  return allowed ? children : fallback;
};

export default Can;
