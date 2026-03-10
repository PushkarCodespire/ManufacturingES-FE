# Dynatech ONE — Frontend CLAUDE.md
> Rules for Claude Code to follow when building frontend features.

---

## NEW FEATURE CHECKLIST — FOLLOW THIS ORDER

When building any new feature page, complete **all 6 steps** in order:

### Step 1: Add Permission Tree Data (if new module)
- Open `src/pages/Masters/Employees/EmployeeDetail.jsx`
- Add your feature's entries to the correct tree (`mastersTree`, `storeTree`, `productionTree`, `ordersTree`, or `procurementTree`)
- Use the helper functions: `leaf(parentKey, label, perms)` with standard perm arrays:
  ```js
  const stdPerms = ['Read', 'Create/Edit/Delete'];
  const dlPerms  = ['Read', 'Create/Edit/Delete', 'Download'];
  ```
- This generates the permission keys automatically. **Never invent permission keys — they must exist in the tree.**

### Step 2: Add Sidebar Navigation Entry
- Open `src/components/AppLayout/AppSidebar.jsx`
- Add your item to `NAV_ITEMS_DEF` in the correct sub-group
- Set the `permission` property to the **read** key from Step 1
- Add a route mapping in `KEY_TO_PATH`
- Update `getNavState()` to handle the new pathname

```js
// NAV_ITEMS_DEF — inside the correct sub-group's children array:
{ key: 'my-feature', label: 'My Feature', permission: 'sites-my_feature-read' },

// KEY_TO_PATH:
'my-feature': '/masters/my-feature',

// getNavState — add before the generic /masters catch-all:
if (pathname.startsWith('/masters/my-feature')) return { selected: 'my-feature', open: ['masters', 'grp-sites'] };
```

**Sidebar structure:**
```
Dashboard                          ← top-level item
Masters (SubMenu)                  ← top-level collapsible
  Sites (SubMenu)                  ← sub-group, collapsible dropdown
    Configuration                  ← leaf item with permission gate
    Employees & Access
    Shifts & Leaves
  Production (SubMenu)
  Planning (SubMenu)
  Inventory (SubMenu)
  Other (SubMenu)
Quality (disabled)                 ← future top-level, adminOnly
...
```

### Step 3: Add Route in App.jsx
- Open `src/App.jsx`
- Import your page component
- Add a `<Route>` wrapped in `<ProtectedRoute>`

```jsx
<Route
  path="/masters/my-feature"
  element={
    <ProtectedRoute permission="sites-my_feature-read">
      <MyFeaturePage />
    </ProtectedRoute>
  }
/>
```

**ProtectedRoute props:**
- `roles={['it_admin', 'plant_head']}` — strict role whitelist (admin-only pages)
- `permission="key"` — anyone with this permission key (admins bypass automatically)
- Both can be combined — either one grants access (OR logic)

### Step 4: Build the Page with Standard Layout
- Use `AppLayout` wrapper (already applied by putting page inside ProtectedRoute)
- Follow the **Configuration page layout pattern** (mandatory for all list pages):

```jsx
{/* Breadcrumb */}
<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
  <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
  <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
  <Text style={{ color: '#6b7280', fontSize: 12 }}>My Feature</Text>
</div>

{/* Title */}
<Title level={3} style={{ margin: 0 }}>My Feature</Title>

{/* Subtitle */}
<Text type="secondary" style={{ fontSize: 13 }}>Description of this feature.</Text>

{/* Stats chips (optional) */}
<div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
  <Tag color="blue">Total: {total}</Tag>
  <Tag color="green">Active: {active}</Tag>
</div>

{/* Card with toolbar + table */}
<Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
  bodyStyle={{ padding: '16px 20px' }}>

  {/* Toolbar: Search | spacer | Refresh | Action button */}
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
    <Input placeholder="Search..." prefix={<SearchOutlined />} value={search}
      onChange={(e) => setSearch(e.target.value)} style={{ width: 240, borderRadius: 8 }} allowClear />
    <div style={{ flex: 1 }} />
    <Button icon={<ReloadOutlined />} onClick={onRefresh}>Refresh</Button>
    {canWrite && (
      <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>Add New</Button>
    )}
  </div>

  <Table ... />
</Card>
```

### Step 5: Apply Permission Gates on the Page

```jsx
import usePermissions from '../../hooks/usePermissions';

const { can } = usePermissions();
const canWrite = can('sites-my_feature-create_edit_delete');
```

**Gate these elements:**
| Element | How |
|---------|-----|
| Add/Create button | `{canWrite && <Button>Add New</Button>}` |
| Edit button | `{canWrite && <Button>Edit</Button>}` |
| Delete button | `{canWrite && <Button>Delete</Button>}` |
| Actions table column | Spread operator: `...(canWrite ? [actionsColumn] : [])` |
| Toggle/Status switch | `{canWrite && <Switch ... />}` |
| Download/Export button | `{canDownload && <Button>Export</Button>}` |
| Form save button | `{canWrite && <Button type="primary">Save</Button>}` |
| Inline editing | `disabled={!canWrite}` on form fields |

**Or use the `<Can>` component for declarative gating:**
```jsx
<Can permission="sites-my_feature-create_edit_delete">
  <Button type="primary">Add New</Button>
</Can>
```

### Step 6: Verify
- [ ] Non-admin user with read-only → sees list, no action buttons
- [ ] Non-admin user with write → sees list + action buttons
- [ ] Admin user → sees everything (bypass)
- [ ] User with no permission → page not accessible, redirects to dashboard
- [ ] Sidebar shows item only if user has read permission
- [ ] Sidebar hides item for users without permission
- [ ] Collapsed sidebar works (tooltips, no broken layout)

---

## PERMISSION SYSTEM — REFERENCE

### Core primitives

| File | Purpose |
|------|---------|
| `src/hooks/usePermissions.js` | `can(key)`, `canAny([])`, `canAll([])`, `isAdmin` |
| `src/hooks/usePermissions.js` | `usePagePermissions(moduleKey)` → `{ canRead, canWrite, canDownload }` |
| `src/components/common/Can.jsx` | Declarative permission gate component |
| `src/routes/ProtectedRoute.jsx` | Route-level gate (roles + permission) |

### Admin bypass
`plant_head` and `it_admin` roles **always** pass every permission check. Never add separate checks for these roles — the hook handles it automatically.

### Permission key format
Keys are generated by the `perm()` / `leaf()` helpers in `EmployeeDetail.jsx`:
```
{parentKey}-{label.replace(/[\s&\/]/g, '_').toLowerCase()}-{permType.replace(/[\s\/]/g, '_').toLowerCase()}
```

Examples:
- `sites-configuration-read`
- `sites-configuration-create_edit_delete`
- `sites-employees___access-create_edit_delete`
- `store-requests-material_request-read`
- `prod-dpr-daily_production_report-create_edit_delete`
- `plan-po-create_po-approve_reject`

**Always check the tree data in `EmployeeDetail.jsx` for the exact key before using it.**

### Permission tree prefixes → Access tabs
| Prefix | Tab | State variable |
|--------|-----|----------------|
| `sites-`, `production-`, `planning-`, `inventory-`, `other-` | Masters | `mastersChecked` |
| `store-` | Store | `storeChecked` |
| `prod-` (NOT `production-`) | Production | `productionChecked` |
| `plan-orders-`, `plan-sales-order-` | Orders | `ordersChecked` |
| other `plan-` (NOT `planning-`) | Procurement | `procurementChecked` |

### Standard permission types
| Array | Keys generated |
|-------|---------------|
| `stdPerms` | `read`, `create_edit_delete` |
| `dlPerms` | `read`, `create_edit_delete`, `download` |
| `bomPerms` | `read`, `create_edit_delete`, `download`, `read_bom`, `create_edit_delete_bom`, `download_bom` |
| `approvalPerms` | `read`, `approve_reject` |

---

## HOW TO APPLY PERMISSIONS — PATTERNS

### 1. Hiding entire sections / pages
```jsx
<Can permission="sites-configuration-read">
  <SitesConfigSection />
</Can>
```

### 2. Hiding action buttons (edit, delete, create)
```jsx
<Can permission="store-requests-material_request-create_edit_delete">
  <Button type="primary" onClick={handleAdd}>Add New</Button>
</Can>
```

### 3. Hiding download buttons
```jsx
<Can permission="store-inventory-stock_ledger-download">
  <Button icon={<DownloadOutlined />}>Export</Button>
</Can>
```

### 4. Read-only mode when no write permission
```jsx
const { can } = usePermissions();
const canEdit = can('sites-configuration-create_edit_delete');

<Table
  columns={[
    ...baseColumns,
    ...(canEdit ? [{
      title: 'Actions', key: 'actions', width: 110,
      render: (_, r) => <EditButton record={r} />,
    }] : []),
  ]}
/>
```

### 5. Using `fallback` for disabled UI
```jsx
<Can
  permission="plan-po-create_po-create_edit_delete"
  fallback={<Button disabled>Create PO (No Access)</Button>}
>
  <Button onClick={handleCreatePO}>Create PO</Button>
</Can>
```

### 6. Programmatic check in handlers
```jsx
const { can } = usePermissions();

const handleDelete = (record) => {
  if (!can('store-transactions-grn-create_edit_delete')) {
    message.error('You do not have permission to delete GRNs');
    return;
  }
  // ... delete logic
};
```

### 7. Using usePagePermissions shorthand
```jsx
import { usePagePermissions } from '../../hooks/usePermissions';

const { canRead, canWrite, canDownload } = usePagePermissions('sites-configuration');
// canRead    = can('sites-configuration-read')
// canWrite   = can('sites-configuration-create_edit_delete')
// canDownload = can('sites-configuration-download')
```

---

## RULES — MANDATORY

1. **Never render action buttons** (Add, Edit, Delete, Approve, Download) without gating with `can()` or `<Can>`.
2. **Never call write APIs** without checking `can()` first in the handler.
3. **Read permission = view the list/page.** If the user lacks read, the page/section should not render.
4. **Write permission = create, edit, delete, approve.** Check before showing action UI.
5. **Download permission = export buttons.** Always wrap with `<Can>`.
6. **Do not hardcode role checks** like `user.Role.name === 'store_manager'`. Use `can()` instead.
7. **Check the exact key from `EmployeeDetail.jsx` tree data** — do not guess key names.
8. **Admin roles bypass everything** — never special-case plant_head/it_admin in permission logic.
9. **Every new page must use the standard layout** — breadcrumb, title, subtitle, Card with toolbar + table.
10. **Every new navigable page must have all 3 entries**: sidebar (`NAV_ITEMS_DEF` + `KEY_TO_PATH` + `getNavState`), route (`App.jsx`), and permission tree (`EmployeeDetail.jsx`).
11. **Sidebar items MUST set `permission` property** to the read key — the sidebar auto-hides items the user cannot access.
12. **`adminOnly: true` items** appear only for plant_head/it_admin, shown disabled (coming-soon state).

---

## SIDEBAR NAVIGATION — ADDING NEW ITEMS

### File: `src/components/AppLayout/AppSidebar.jsx`

**Structure**: 3-level deep — Top-level (Masters) → Sub-group (Sites) → Leaf item (Configuration)

```js
// 1. Add leaf item to NAV_ITEMS_DEF in the correct sub-group:
{ key: 'my-feature', label: 'My Feature', permission: 'sites-my_feature-read' },

// 2. Add route mapping:
const KEY_TO_PATH = {
  ...existing,
  'my-feature': '/masters/my-feature',
};

// 3. Add pathname detection (BEFORE the generic /masters catch-all):
if (pathname.startsWith('/masters/my-feature'))
  return { selected: 'my-feature', open: ['masters', 'grp-sites'] };
```

**Open keys by sub-group:**
| Sub-group | `open` array |
|-----------|-------------|
| Sites | `['masters', 'grp-sites']` |
| Production | `['masters', 'grp-production']` |
| Planning | `['masters', 'grp-planning']` |
| Inventory | `['masters', 'grp-inventory']` |
| Other | `['masters', 'grp-other']` |

### Item properties
| Property | Type | Description |
|----------|------|-------------|
| `key` | string | Unique key, used in `KEY_TO_PATH` and `selectedKeys` |
| `label` | string | Display text in sidebar |
| `icon` | ReactNode | Only for top-level items (Dashboard, Masters, Quality, etc.) |
| `permission` | string | Read permission key — sidebar auto-hides if user lacks this |
| `disabled` | boolean | Renders item grayed out (coming-soon) |
| `adminOnly` | boolean | Only visible to plant_head / it_admin |
| `children` | array | Makes it a SubMenu (collapsible dropdown) |

---

## ROUTE PROTECTION — App.jsx

### ProtectedRoute props

| Prop | Type | Behavior |
|------|------|----------|
| `roles` | string[] | Only these role names can access. Admins always pass. |
| `permission` | string | Anyone with this permission key. Admins always pass. |
| Both | roles + permission | Either one grants access (OR logic). |
| Neither | — | Any authenticated user can access. |

### Pattern for new routes
```jsx
// Import at top
import MyFeaturePage from './pages/Masters/MyFeature';

// Add route (BEFORE the catch-all)
<Route
  path="/masters/my-feature"
  element={
    <ProtectedRoute permission="sites-my_feature-read">
      <MyFeaturePage />
    </ProtectedRoute>
  }
/>

// For sub-pages (detail/edit):
<Route
  path="/masters/my-feature/:id"
  element={
    <ProtectedRoute permission="sites-my_feature-read">
      <MyFeatureDetailPage />
    </ProtectedRoute>
  }
/>
```

---

## WHERE PERMISSIONS COME FROM

- Assigned in `Masters > Employees > Employee Detail > [Access Tabs]`
- Stored in `users.permissions` (JSONB, flat string array)
- Included in login response and available via `useAuth().user.permissions`
- Split into tree states on EmployeeDetail load by prefix (store-, prod-, plan-, masters)

---

## PAGE LAYOUT — STANDARD PATTERN

All list pages **must** follow this structure (same as Configuration page):

```
┌─────────────────────────────────────────────────┐
│ Masters > My Feature              (breadcrumb)  │
│ My Feature                        (title h3)    │
│ Description of feature            (subtitle)    │
│ [Total: 5] [Active: 3]          (stat chips)   │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ [Search...] ──── [Refresh] [+ Add New]      │ │ ← Card toolbar
│ │─────────────────────────────────────────────│ │
│ │ Name    │ Status │ Created │ Actions        │ │ ← Table
│ │ ...     │ ...    │ ...     │ Edit | Delete  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Card styles:**
```js
{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }
bodyStyle={{ padding: '16px 20px' }}
```

---

## TECH STACK REMINDERS

- **Framework:** React + React Router v6
- **UI Library:** Ant Design v5
- **State:** useState / useContext (AuthContext)
- **API:** Axios (interceptor auto-unwraps `res.data` — do NOT call `.data` again in components)
- **Auth:** JWT stored in localStorage (`dt_token`)
- **Routing:** `ProtectedRoute` wraps role-gated pages in `App.jsx`
- **Sidebar:** 248px expanded, 64px collapsed, fixed position
- **Header:** 52px fixed, z-index 200
- **Theme:** Ant Design ConfigProvider with custom tokens in `App.jsx`
- **Colors:** Primary `#1d4ed8`, Background `#f4f6f9`, Border `#e8eaed`
