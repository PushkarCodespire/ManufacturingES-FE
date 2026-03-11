import React, { useState, useEffect, useMemo } from 'react';
import {
  Layout, Menu, Avatar, Typography, Button, Tooltip,
} from 'antd';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  CarOutlined,
  DatabaseOutlined,
  TeamOutlined,
  DollarOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  KeyOutlined,
  ControlOutlined,
  SolutionOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth }        from '../../context/AuthContext';
import usePermissions from '../../hooks/usePermissions';

const { Sider } = Layout;
const { Text }  = Typography;

// Department accent colors
const DEPT_COLORS = {
  10: '#1d4ed8', 11: '#16a34a', 12: '#b45309', 13: '#7c3aed',
  14: '#dc2626', 15: '#0d9488', 16: '#1d4ed8', 17: '#92400e',
};

// ── Navigation definition ──────────────────────────────────────────────────────
// permission  : string → visible if user has this permission key (admins always pass)
// permission  : null   → always visible
// adminOnly   : true   → visible only to plant_head / it_admin (disabled/coming-soon)
//
// Sub-categories under Masters are collapsible SubMenus (dropdowns).
// Add new routes here as pages are built — the sidebar filters automatically.
const NAV_ITEMS_DEF = [
  {
    key:        'dashboard',
    label:      'Dashboard',
    icon:       <AppstoreOutlined />,
    permission: null,             // always show
  },

  // ── Masters ──────────────────────────────────────────────────────────────────
  {
    key:   'masters',
    label: 'Masters',
    icon:  <ControlOutlined />,
    children: [
      // ── Sites (SubMenu) ────────────────────────────
      {
        key:   'grp-sites',
        label: 'Sites',
        children: [
          { key: 'configuration', label: 'Configuration',      permission: 'sites-configuration-read' },
          { key: 'employees',     label: 'Employees & Access', permission: 'sites-employees___access-read' },
          { key: 'shifts',        label: 'Shifts & Leaves',    permission: 'sites-shifts___leaves-read' },
          { key: 'integrations',  label: 'Integrations',       permission: 'sites-integrations-read' },
          { key: 'costing',       label: 'Costing',            permission: 'sites-costing-read' },
        ],
      },
      // ── Production (SubMenu) ───────────────────────
      {
        key:   'grp-production',
        label: 'Production',
        children: [
          { key: 'm-machines',         label: 'Machines',            permission: 'production-machines-read' },
          { key: 'm-items',            label: 'Items',               permission: 'production-items-read' },
          { key: 'm-cycle-time',       label: 'Cycle Time Rules',    permission: 'production-items-read' },
          { key: 'm-tools',            label: 'Tools',               permission: 'production-tools-read' },
          { key: 'm-downtime',         label: 'Downtime',            permission: 'production-downtime-read' },
          { key: 'm-quality',          label: 'Quality',             permission: 'production-quality-read' },
          { key: 'm-production-forms', label: 'Production Forms',    permission: 'production-production_forms-read' }
        ],
      },
      // ── Planning (SubMenu) ─────────────────────────
      {
        key:   'grp-planning',
        label: 'Planning',
        children: [
          { key: 'm-customers',         label: 'Customers',         permission: 'planning-vendors-read' },
          { key: 'm-vendors',           label: 'Vendors',           permission: 'planning-vendors-read' },
          { key: 'm-sticker-templates', label: 'Sticker Templates', permission: 'planning-sticker_templates-read' },
        ],
      },
      // ── Inventory (SubMenu) ────────────────────────
      {
        key:   'grp-inventory',
        label: 'Inventory',
        children: [
          { key: 'm-warehouses',    label: 'Warehouses',    permission: 'inventory-warehouses-read'   },
          { key: 'm-packages',      label: 'Packages',      permission: 'inventory-packages-read'     },
          { key: 'm-custom-fields', label: 'Custom Fields', permission: 'inventory-custom_fields-read' },
        ],
      },
      // ── Other (SubMenu) ────────────────────────────
      {
        key:   'grp-other',
        label: 'Other',
        children: [
          { key: 'm-reports',        label: 'Reports',        permission: 'other-reports-read'        },
          { key: 'm-tag-management', label: 'Tag Management', permission: 'other-tag_management-read' },
          { key: 'm-templates',      label: 'Templates',      permission: 'other-templates-read'      },
          { key: 'm-automation',     label: 'Automation',     disabled: true, adminOnly: true },
          { key: 'm-onboarding',     label: 'Onboarding',     disabled: true, adminOnly: true },
        ],
      },
    ],
  },

  // ── Orders module ────────────────────────────────────────────────────────────
  {
    key:   'orders',
    label: 'Orders',
    icon:  <SolutionOutlined />,
    children: [
      { key: 'o-rfq',            label: 'RFQ',            permission: 'plan-orders-rfq-read'            },
      { key: 'o-quotation',      label: 'Quotation',      permission: 'plan-orders-quotation-read'      },
      { key: 'o-customer-po',    label: 'Customer PO',    permission: 'plan-orders-customer_po-read'    },
      { key: 'o-order-tracking', label: 'Order Tracking', permission: 'plan-orders-order_tracking-read' },
    ],
  },

  // ── Quality & NPD module ──────────────────────────────────────────────────
  {
    key:   'quality',
    label: 'Quality',
    icon:  <CheckCircleOutlined />,
    children: [
      // ── Quality Control ────────────────────────────────────
      {
        key:   'grp-qms',
        label: 'Quality Control',
        children: [
          { key: 'q-capa',       label: 'CAPA / 8D',         permission: 'quality-capa-read'       },
          { key: 'q-ncr',        label: 'Internal NCR',       permission: 'quality-ncr-read'        },
          { key: 'q-complaints', label: 'Customer Complaints',permission: 'quality-complaints-read' },
          { key: 'q-instruments',label: 'Instruments',         permission: 'quality-instruments-read'},
        ],
      },
      // ── NPD / Documents ────────────────────────────────────
      {
        key:   'grp-npd',
        label: 'NPD / Documents',
        children: [
          { key: 'q-drawings',     label: 'Drawings',      permission: 'npd-drawings-read'     },
          { key: 'q-check-sheets', label: 'Check Sheets',  permission: 'npd-check_sheets-read' },
          { key: 'q-pfmea',        label: 'PFMEA',         permission: 'npd-pfmea-read'        },
        ],
      },
    ],
  },

  // ── Procurement module ────────────────────────────────────────────────────
  {
    key:   'procurement',
    label: 'Procurement',
    icon:  <ShoppingCartOutlined />,
    children: [
      { key: 'purchase-orders',     label: 'Purchase Orders',     permission: 'plan-po-create_po-read' },
      { key: 'bom-explosion',       label: 'BOM Explosion',       permission: 'plan-bom-explosion-bom_explosion-read' },
      { key: 'supplier-scorecard',  label: 'Supplier Scorecard',  permission: 'plan-supplier-scorecard-supplier_scorecard-read' },
      { key: 'scar',                label: 'SCAR',                permission: 'plan-scar-scar-read' },
      {
        key:   'grp-subcontracting',
        label: 'Subcontracting',
        children: [
          { key: 'outward-challan', label: 'Outward Challan', permission: 'plan-subcontracting-outward_challan-read' },
          { key: 'inward-challan',  label: 'Inward Challan',  permission: 'plan-subcontracting-inward_challan-read'  },
        ],
      },
    ],
  },

  // ── Store module ─────────────────────────────────────────────────────────
  {
    key:   'store',
    label: 'Store',
    icon:  <DatabaseOutlined />,
    children: [
      {
        key:   'grp-store-transactions',
        label: 'Transactions',
        children: [
          { key: 's-grn',        label: 'GRN',       permission: 'store-transactions-grn-read'        },
          { key: 's-issue-slip', label: 'Issue Slip', permission: 'store-transactions-issue_slip-read' },
        ],
      },
      {
        key:   'grp-store-requests',
        label: 'Requests',
        children: [
          { key: 's-material-request', label: 'Material Request', permission: 'store-requests-material_request-read' },
        ],
      },
      {
        key:   'grp-store-inventory',
        label: 'Inventory',
        children: [
          { key: 's-inventory-dashboard', label: 'Dashboard',        permission: 'store-inventory-dashboard-read'       },
          { key: 's-stock-ledger',        label: 'Stock Ledger',     permission: 'store-inventory-stock_ledger-read'     },
          { key: 's-stock-adjustment',    label: 'Stock Adjustment', permission: 'store-inventory-stock_adjustment-read' },
        ],
      },
    ],
  },

  // ── Production module ─────────────────────────────────────────────────────
  {
    key:   'production',
    label: 'Production',
    icon:  <ToolOutlined />,
    children: [
      { key: 'work-orders',          label: 'Work Orders',       permission: 'prod-work_centre-manage_work_centre-read'          },
      { key: 'job-cards',            label: 'Job Cards',         permission: 'prod-dpr-daily_production_report-read'             },
      { key: 'iqc',                  label: 'IQC Inspection',    permission: 'prod-quality_level-iqc-read'                       },
      { key: 'lqc',                  label: 'LQC Inspection',    permission: 'prod-quality_level-iqc-read'                       },
      { key: 'pqc',                  label: 'PQC Inspection',    permission: 'prod-quality_level-pqc-read'                       },
      { key: 'oqc',                  label: 'OQC Inspection',    permission: 'prod-quality_level-oqc-read'                       },
      { key: 'production-scheduling',label: 'Scheduling',        permission: 'prod-mrp_expected_production-create_plan-read'     },
      { key: 'scrap-vouchers',       label: 'Scrap Authorization',permission: 'prod-dpr-rejection_entry-read'                   },
    ],
  },
  {
    key:   'accounts',
    label: 'Accounts',
    icon:  <DollarOutlined />,
    roles: ['accounts_manager', 'accounts_incharge', 'it_admin', 'plant_head'],
    children: [
      { key: 'acc-tally-sync',        label: 'Tally Sync'         },
      { key: 'acc-invoices',           label: 'Sales Invoices'     },
      { key: 'acc-debit-credit-notes', label: 'Debit/Credit Notes' },
      { key: 'acc-payments',           label: 'Payments'           },
      { key: 'acc-copq',              label: 'COPQ'               },
    ],
  },

  // ── Dispatch & Logistics — dispatch_manager, it_admin, plant_head only ─────────
  {
    key:   'dispatch',
    label: 'Dispatch',
    icon:  <CarOutlined />,
    roles: ['dispatch_manager', 'it_admin', 'plant_head'],
    children: [
      { key: 'dispatch-transporters', label: 'Transporters'      },
      { key: 'dispatch-orders',       label: 'Dispatch Orders'   },
      { key: 'dispatch-challans',     label: 'Delivery Challans' },
      { key: 'dispatch-tracking',     label: 'Shipment Tracking' },
      { key: 'dispatch-reports',      label: 'Reports'           },
    ],
  },

  // ── HR & Training — visible to hr_admin, it_admin, plant_head only ──────────
  {
    key:   'hr',
    label: 'HR & Training',
    icon:  <TeamOutlined />,
    roles: ['hr_admin', 'it_admin', 'plant_head'],
    children: [
      { key: 'hr-training-topics',   label: 'Training Topics'   },
      { key: 'hr-role-requirements', label: 'Role Requirements' },
      { key: 'hr-training-records',  label: 'Training Records'  },
      { key: 'hr-competency-matrix', label: 'Competency Matrix' },
      { key: 'hr-effectiveness',     label: 'Effectiveness'     },
    ],
  },

  // ── Admin ────────────────────────────────────────────────────────────────────
  {
    key:   'admin',
    label: 'Admin',
    icon:  <SettingOutlined />,
    roles: ['plant_head', 'it_admin'],
    children: [
      { key: 'admin-control-room', label: 'Control Room' },
    ],
  },
];

// key → route path (for items that navigate)
const KEY_TO_PATH = {
  dashboard:       '/dashboard',
  configuration:   '/masters/configuration',
  employees:       '/masters/employees',
  shifts:          '/masters/shifts',
  'm-machines':         '/masters/production/machines',
  'm-items':            '/masters/production/items',
  'm-production-forms': '/masters/production/production-forms',
  'm-cycle-time':       '/masters/production/cycle-time-rules',
  'm-tools':            '/masters/production/tools',
  'm-downtime':         '/masters/production/downtime',
  'm-quality':          '/masters/production/quality',
  'm-warehouses':      '/masters/inventory/warehouses',
  'm-packages':        '/masters/inventory/packages',
  'm-reports':         '/masters/other/reports',
  'm-tag-management':  '/masters/other/tag-management',
  'm-templates':       '/masters/other/templates',
  'm-vendors':       '/masters/planning/vendors',
  'm-customers':         '/masters/planning/customers',
  'm-sticker-templates': '/masters/planning/sticker-templates',
  'costing':             '/masters/costing',
  'integrations':    '/masters/integrations',
  'm-custom-fields': '/masters/inventory/custom-fields',
  // Orders module
  'o-rfq':            '/orders/rfq',
  'o-quotation':      '/orders/quotation',
  'o-customer-po':    '/orders/customer-po',
  'o-order-tracking': '/orders/tracking',
  // Store module
  's-grn':                '/store/grn',
  's-issue-slip':         '/store/issue-slip',
  's-material-request':   '/store/material-request',
  's-inventory-dashboard':'/store/inventory-dashboard',
  's-stock-ledger':       '/store/stock-ledger',
  's-stock-adjustment':   '/store/stock-adjustment',
  // Production module
  'work-orders':           '/production/work-orders',
  'job-cards':             '/production/job-cards',
  'iqc':                   '/production/iqc',
  'lqc':                   '/production/lqc',
  'pqc':                   '/production/pqc',
  'oqc':                   '/production/oqc',
  'production-scheduling': '/production/scheduling',
  'scrap-vouchers':        '/production/scrap',
  // Quality & NPD module
  'q-capa':         '/quality/capa',
  'q-ncr':          '/quality/ncr',
  'q-complaints':   '/quality/complaints',
  'q-instruments':  '/quality/instruments',
  'q-drawings':     '/quality/drawings',
  'q-check-sheets': '/quality/check-sheets',
  'q-pfmea':        '/quality/pfmea',
  // Procurement module
  'purchase-orders':    '/procurement/purchase-orders',
  'bom-explosion':      '/procurement/bom-explosion',
  'supplier-scorecard': '/procurement/supplier-scorecard',
  'scar':               '/procurement/scar',
  'outward-challan': '/subcontracting/outward',
  'inward-challan':  '/subcontracting/inward',
  // HR & Training
  'hr-training-topics':   '/hr/training-topics',
  'hr-role-requirements': '/hr/role-requirements',
  'hr-training-records':  '/hr/training-records',
  'hr-competency-matrix': '/hr/competency-matrix',
  'hr-effectiveness':     '/hr/effectiveness',
  // Accounts
  'acc-tally-sync':        '/accounts/tally-sync',
  'acc-invoices':          '/accounts/invoices',
  'acc-debit-credit-notes':'/accounts/debit-credit-notes',
  'acc-payments':          '/accounts/payments',
  'acc-copq':              '/accounts/copq',
  // Dispatch & Logistics
  'dispatch-transporters': '/dispatch/transporters',
  'dispatch-orders':       '/dispatch/orders',
  'dispatch-challans':     '/dispatch/challans',
  'dispatch-tracking':     '/dispatch/tracking',
  'dispatch-reports':      '/dispatch/reports',
  // Admin
  'admin-control-room':    '/admin/control-room',
};

// ── Derive selected key + open keys from current pathname ────────────────────
// Both parent SubMenu (masters) AND child SubMenu (grp-sites etc.) are tracked
const getNavState = (pathname) => {
  // Sites sub-group
  if (pathname.startsWith('/masters/employees'))     return { selected: 'employees',     open: ['masters', 'grp-sites'] };
  if (pathname.startsWith('/masters/configuration')) return { selected: 'configuration', open: ['masters', 'grp-sites'] };
  if (pathname.startsWith('/masters/shifts'))        return { selected: 'shifts',        open: ['masters', 'grp-sites'] };
  if (pathname.startsWith('/masters/costing'))        return { selected: 'costing',       open: ['masters', 'grp-sites'] };
  if (pathname.startsWith('/masters/integrations'))   return { selected: 'integrations',  open: ['masters', 'grp-sites'] };
  // Production sub-group
  if (pathname.startsWith('/masters/production/machines'))         return { selected: 'm-machines',         open: ['masters', 'grp-production'] };
  if (pathname.startsWith('/masters/production/items'))            return { selected: 'm-items',            open: ['masters', 'grp-production'] };
  if (pathname.startsWith('/masters/production/production-forms')) return { selected: 'm-production-forms', open: ['masters', 'grp-production'] };
  if (pathname.startsWith('/masters/production/cycle-time-rules')) return { selected: 'm-cycle-time',       open: ['masters', 'grp-production'] };
  if (pathname.startsWith('/masters/production/tools'))            return { selected: 'm-tools',            open: ['masters', 'grp-production'] };
  if (pathname.startsWith('/masters/production/downtime'))         return { selected: 'm-downtime',         open: ['masters', 'grp-production'] };
  if (pathname.startsWith('/masters/production/quality'))          return { selected: 'm-quality',          open: ['masters', 'grp-production'] };
  // Inventory sub-group
  if (pathname.startsWith('/masters/inventory/warehouses')) return { selected: 'm-warehouses', open: ['masters', 'grp-inventory'] };
  if (pathname.startsWith('/masters/inventory/packages'))   return { selected: 'm-packages',   open: ['masters', 'grp-inventory'] };
  // Other sub-group
  if (pathname.startsWith('/masters/other/reports'))        return { selected: 'm-reports',        open: ['masters', 'grp-other'] };
  if (pathname.startsWith('/masters/other/tag-management')) return { selected: 'm-tag-management', open: ['masters', 'grp-other'] };
  if (pathname.startsWith('/masters/other/templates'))      return { selected: 'm-templates',      open: ['masters', 'grp-other'] };
  if (pathname.startsWith('/masters/inventory/custom-fields')) return { selected: 'm-custom-fields', open: ['masters', 'grp-inventory'] };
  // Planning sub-group
  if (pathname.startsWith('/masters/planning/sticker-templates')) return { selected: 'm-sticker-templates', open: ['masters', 'grp-planning'] };
  if (pathname.startsWith('/masters/planning/customers'))         return { selected: 'm-customers',         open: ['masters', 'grp-planning'] };
  if (pathname.startsWith('/masters/planning/vendors'))           return { selected: 'm-vendors',           open: ['masters', 'grp-planning'] };
  // Quality & NPD module
  if (pathname.startsWith('/quality/capa'))         return { selected: 'q-capa',         open: ['quality', 'grp-qms'] };
  if (pathname.startsWith('/quality/ncr'))          return { selected: 'q-ncr',          open: ['quality', 'grp-qms'] };
  if (pathname.startsWith('/quality/complaints'))   return { selected: 'q-complaints',   open: ['quality', 'grp-qms'] };
  if (pathname.startsWith('/quality/instruments'))   return { selected: 'q-instruments',   open: ['quality', 'grp-qms'] };
  if (pathname.startsWith('/quality/drawings'))     return { selected: 'q-drawings',     open: ['quality', 'grp-npd'] };
  if (pathname.startsWith('/quality/check-sheets')) return { selected: 'q-check-sheets', open: ['quality', 'grp-npd'] };
  if (pathname.startsWith('/quality/pfmea'))        return { selected: 'q-pfmea',        open: ['quality', 'grp-npd'] };
  // Orders module
  if (pathname.startsWith('/orders/rfq'))       return { selected: 'o-rfq',            open: ['orders'] };
  if (pathname.startsWith('/orders/quotation')) return { selected: 'o-quotation',      open: ['orders'] };
  if (pathname.startsWith('/orders/customer-po')) return { selected: 'o-customer-po',  open: ['orders'] };
  if (pathname.startsWith('/orders/tracking'))  return { selected: 'o-order-tracking', open: ['orders'] };
  // Store module
  if (pathname.startsWith('/store/grn'))               return { selected: 's-grn',              open: ['store', 'grp-store-transactions'] };
  if (pathname.startsWith('/store/issue-slip'))         return { selected: 's-issue-slip',        open: ['store', 'grp-store-transactions'] };
  if (pathname.startsWith('/store/material-request'))   return { selected: 's-material-request',  open: ['store', 'grp-store-requests']     };
  if (pathname.startsWith('/store/inventory-dashboard')) return { selected: 's-inventory-dashboard',open: ['store', 'grp-store-inventory']    };
  if (pathname.startsWith('/store/stock-ledger'))       return { selected: 's-stock-ledger',      open: ['store', 'grp-store-inventory']    };
  if (pathname.startsWith('/store/stock-adjustment'))   return { selected: 's-stock-adjustment',  open: ['store', 'grp-store-inventory']    };
  // Production module
  if (pathname.startsWith('/production/work-orders'))  return { selected: 'work-orders',           open: ['production'] };
  if (pathname.startsWith('/production/job-cards'))    return { selected: 'job-cards',             open: ['production'] };
  if (pathname.startsWith('/production/iqc'))          return { selected: 'iqc',                   open: ['production'] };
  if (pathname.startsWith('/production/lqc'))          return { selected: 'lqc',                   open: ['production'] };
  if (pathname.startsWith('/production/pqc'))          return { selected: 'pqc',                   open: ['production'] };
  if (pathname.startsWith('/production/oqc'))          return { selected: 'oqc',                   open: ['production'] };
  if (pathname.startsWith('/production/scheduling'))   return { selected: 'production-scheduling', open: ['production'] };
  if (pathname.startsWith('/production/scrap'))        return { selected: 'scrap-vouchers',        open: ['production'] };
  // Procurement module
  if (pathname.startsWith('/procurement/bom-explosion'))       return { selected: 'bom-explosion',      open: ['procurement'] };
  if (pathname.startsWith('/procurement/supplier-scorecard'))  return { selected: 'supplier-scorecard', open: ['procurement'] };
  if (pathname.startsWith('/procurement/scar'))                return { selected: 'scar',               open: ['procurement'] };
  if (pathname.startsWith('/procurement/'))                    return { selected: 'purchase-orders',    open: ['procurement'] };
  if (pathname.startsWith('/subcontracting/outward'))  return { selected: 'outward-challan',   open: ['procurement', 'grp-subcontracting']    };
  if (pathname.startsWith('/subcontracting/inward'))   return { selected: 'inward-challan',    open: ['procurement', 'grp-subcontracting']    };
  // Accounts module
  if (pathname.startsWith('/accounts/tally-sync'))        return { selected: 'acc-tally-sync',        open: ['accounts'] };
  if (pathname.startsWith('/accounts/invoices'))           return { selected: 'acc-invoices',           open: ['accounts'] };
  if (pathname.startsWith('/accounts/debit-credit-notes')) return { selected: 'acc-debit-credit-notes', open: ['accounts'] };
  if (pathname.startsWith('/accounts/payments'))           return { selected: 'acc-payments',           open: ['accounts'] };
  if (pathname.startsWith('/accounts/copq'))               return { selected: 'acc-copq',              open: ['accounts'] };
  // Admin
  if (pathname.startsWith('/admin/control-room')) return { selected: 'admin-control-room', open: ['admin'] };
  // Generic masters fallback
  if (pathname.startsWith('/masters'))               return { selected: 'masters',       open: ['masters'] };
  // HR & Training
  if (pathname.startsWith('/hr/training-topics'))   return { selected: 'hr-training-topics',   open: ['hr'] };
  if (pathname.startsWith('/hr/role-requirements')) return { selected: 'hr-role-requirements', open: ['hr'] };
  if (pathname.startsWith('/hr/training-records'))  return { selected: 'hr-training-records',  open: ['hr'] };
  if (pathname.startsWith('/hr/competency-matrix')) return { selected: 'hr-competency-matrix', open: ['hr'] };
  if (pathname.startsWith('/hr/effectiveness'))     return { selected: 'hr-effectiveness',     open: ['hr'] };
  // Dispatch & Logistics
  if (pathname.startsWith('/dispatch/transporters')) return { selected: 'dispatch-transporters', open: ['dispatch'] };
  if (pathname.startsWith('/dispatch/orders'))       return { selected: 'dispatch-orders',       open: ['dispatch'] };
  if (pathname.startsWith('/dispatch/challans'))     return { selected: 'dispatch-challans',     open: ['dispatch'] };
  if (pathname.startsWith('/dispatch/tracking'))     return { selected: 'dispatch-tracking',     open: ['dispatch'] };
  if (pathname.startsWith('/dispatch/reports'))      return { selected: 'dispatch-reports',      open: ['dispatch'] };
  return { selected: 'dashboard', open: [] };
};

// ── Strip orphan dividers (leading, trailing, consecutive) ───────────────────
const cleanDividers = (items) =>
  items.filter((item, i, arr) => {
    if (item?.type !== 'divider') return true;
    if (i === 0 || i === arr.length - 1) return false;
    if (arr[i - 1]?.type === 'divider') return false;
    return true;
  });

// ── Component ────────────────────────────────────────────────────────────────
const AppSidebar = ({ collapsed, onCollapse }) => {
  const { user, logout } = useAuth();
  const { can, isAdmin } = usePermissions();
  const navigate         = useNavigate();
  const location         = useLocation();

  const { selected, open: initialOpen } = getNavState(location.pathname);
  const [openKeys, setOpenKeys] = useState(initialOpen);

  // Sync open keys when route changes (e.g. programmatic navigation)
  // Merge required keys so manually-opened sub-groups stay open
  useEffect(() => {
    const { open } = getNavState(location.pathname);
    setOpenKeys((prev) => {
      const merged = new Set([...prev, ...open]);
      return [...merged];
    });
  }, [location.pathname]);

  const deptColor = DEPT_COLORS[user?.department?.code] || '#1d4ed8';
  const initials  = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  // ── Build filtered menu items based on current user's permissions ──────────
  const menuItems = useMemo(() => {
    const userRoleName = user?.role?.name;

    const resolveItem = (item) => {
      // Pass-through dividers
      if (item.type === 'divider') return item;

      const { key, label, icon, disabled, permission, adminOnly, roles, children, type } = item;

      // Role whitelist — hide entirely for anyone whose role is not in the list
      if (roles) {
        if (!roles.includes(userRoleName)) return null;
        // User's role is allowed — resolve children recursively if any
        if (children) {
          const visible = children.map(resolveItem).filter(Boolean);
          if (visible.length === 0) return null;
          const cleaned = cleanDividers(visible);
          return cleaned.length > 0 ? { key, label, icon, children: cleaned, type } : null;
        }
        return { key, label, icon, type };
      }
      // Permission-gated leaf
      if (permission) {
        return can(permission) ? { key, label, icon, type } : null;
      }
      // Admin-only disabled item
      if (adminOnly) {
        return isAdmin ? { key, label, icon, disabled: true, type } : null;
      }
      // Has children (SubMenu or Group) — filter recursively
      if (children) {
        const visible = children.map(resolveItem).filter(Boolean);
        if (visible.length === 0) return null;
        // Clean orphan dividers inside this group/submenu
        const cleaned = cleanDividers(visible);
        return cleaned.length > 0 ? { key, label, icon, children: cleaned, type } : null;
      }
      // Unrestricted item
      return { key, label, icon, type };
    };

    return NAV_ITEMS_DEF.map(resolveItem).filter(Boolean);
  }, [can, isAdmin, user?.role?.name]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleMenuClick = ({ key }) => {
    const path = KEY_TO_PATH[key];
    if (path) navigate(path);
  };

  return (
    <Sider
      width={248}
      collapsedWidth={64}
      collapsed={collapsed}
      style={{
        background:  '#ffffff',
        borderRight: '1px solid #e8eaed',
        position:    'fixed',
        top:         52,
        left:        0,
        bottom:      0,
        zIndex:      100,
        overflow:    collapsed ? 'visible' : 'hidden',
        boxShadow:   '2px 0 8px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── COMPACT USER PANEL ──────────────────────────────────────────── */}
        <div
          style={{
            padding:      collapsed ? '12px 0' : '12px 14px',
            borderBottom: '1px solid #f0f0f0',
            flexShrink:   0,
            display:      'flex',
            alignItems:   'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition:   'padding 0.2s ease',
          }}
        >
          {collapsed ? (
            <Tooltip title={user?.name} placement="right">
              <Avatar
                size={32}
                style={{
                  background: deptColor,
                  fontWeight: 700,
                  fontSize:   13,
                  cursor:     'pointer',
                  boxShadow:  `0 2px 6px ${deptColor}30`,
                }}
                onClick={() => navigate('/profile')}
              >
                {initials}
              </Avatar>
            </Tooltip>
          ) : (
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        10,
                cursor:     'pointer',
                width:      '100%',
                minWidth:   0,
              }}
              onClick={() => navigate('/profile')}
            >
              <Avatar
                size={32}
                style={{
                  background: deptColor,
                  fontWeight: 700,
                  fontSize:   13,
                  flexShrink: 0,
                  boxShadow:  `0 2px 6px ${deptColor}30`,
                }}
              >
                {initials}
              </Avatar>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Text
                  ellipsis
                  style={{
                    fontSize:   13,
                    fontWeight: 600,
                    color:      '#111827',
                    display:    'block',
                    lineHeight: '18px',
                  }}
                >
                  {user?.name}
                </Text>
                <Text
                  ellipsis
                  style={{
                    fontSize:   11,
                    color:      '#6b7280',
                    display:    'block',
                    lineHeight: '16px',
                  }}
                >
                  {user?.role?.label}
                </Text>
              </div>
            </div>
          )}
        </div>

        {/* ── NAVIGATION MENU ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: collapsed ? 'visible' : 'hidden' }}>
          <Menu
            mode="inline"
            inlineCollapsed={collapsed}
            inlineIndent={16}
            selectedKeys={[selected]}
            {...(collapsed
              ? {}  // collapsed: no openKeys control — let Ant Design handle popup state internally
              : { openKeys, onOpenChange: (keys) => setOpenKeys(keys) }
            )}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ border: 'none', background: 'transparent', paddingTop: 4 }}
          />
        </div>

        {/* ── BOTTOM ACTIONS ─────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, borderTop: '1px solid #f0f0f0', padding: '6px 8px' }}>
          {collapsed ? (
            <>
              {isAdmin && (
                <Tooltip title="Reset Password" placement="right">
                  <Button
                    type="text"
                    icon={<KeyOutlined />}
                    style={{ width: '100%', color: '#6b7280', marginBottom: 2 }}
                    onClick={() => navigate('/admin/reset-password')}
                  />
                </Tooltip>
              )}
              <Tooltip title="Sign Out" placement="right">
                <Button
                  type="text"
                  danger
                  icon={<LogoutOutlined />}
                  style={{ width: '100%', marginBottom: 2 }}
                  onClick={handleLogout}
                />
              </Tooltip>
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 6, marginTop: 2, display: 'flex', justifyContent: 'center' }}>
                <Tooltip title="Expand sidebar" placement="right">
                  <Button
                    type="text"
                    size="small"
                    icon={<MenuUnfoldOutlined />}
                    onClick={onCollapse}
                    style={{ color: '#9ca3af' }}
                  />
                </Tooltip>
              </div>
            </>
          ) : (
            <>
              {isAdmin && (
                <Button
                  type="text"
                  icon={<KeyOutlined />}
                  block
                  style={{
                    textAlign:      'left',
                    justifyContent: 'flex-start',
                    color:          '#6b7280',
                    fontSize:       12,
                    height:         32,
                    paddingInline:  10,
                    marginBottom:   2,
                    borderRadius:   6,
                    display:        'flex',
                    alignItems:     'center',
                  }}
                  onClick={() => navigate('/admin/reset-password')}
                >
                  Reset Password
                </Button>
              )}
              {/* Sign out + collapse toggle on same row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Button
                  type="text"
                  danger
                  icon={<LogoutOutlined />}
                  size="small"
                  style={{ fontSize: 12, paddingInline: 10, borderRadius: 6 }}
                  onClick={handleLogout}
                >
                  Sign Out
                </Button>
                <Tooltip title="Collapse sidebar" placement="right">
                  <Button
                    type="text"
                    size="small"
                    icon={<MenuFoldOutlined />}
                    onClick={onCollapse}
                    style={{ color: '#9ca3af', borderRadius: 6 }}
                  />
                </Tooltip>
              </div>
            </>
          )}
        </div>

      </div>
    </Sider>
  );
};

export default AppSidebar;
