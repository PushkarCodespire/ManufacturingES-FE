import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Tabs, Tag, Badge, Button, Row, Col, Skeleton,
  Tree, Form, Select, Input, message, Descriptions, Avatar, Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  BankOutlined,
  HomeOutlined,
  SafetyCertificateOutlined,
  AppstoreOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  ApartmentOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  SolutionOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
  InboxOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { userApi } from '../../../api/user.api';
import AppLayout   from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;

// ── Department colour map ───────────────────────────────────────────────────
const DEPT_COLORS = {
  10: '#1d4ed8', 11: '#16a34a', 12: '#b45309', 13: '#7c3aed',
  14: '#dc2626', 15: '#0d9488', 16: '#1d4ed8', 17: '#92400e',
};

// ── Landing page options ────────────────────────────────────────────────────
const LANDING_PAGE_OPTIONS = [
  { value: 'dashboard',   label: 'Dashboard (Default)' },
  { value: 'iqc',         label: 'Incoming QC'         },
  { value: 'procurement', label: 'Procurement'         },
  { value: 'store',       label: 'Store'               },
  { value: 'production',  label: 'Production'          },
  { value: 'dispatch',    label: 'Dispatch'            },
  { value: 'accounts',    label: 'Accounts'            },
  { value: 'hr',          label: 'HR'                  },
  { value: 'sales',       label: 'Sales'               },
];

const LANDING_PAGE_MAP = Object.fromEntries(LANDING_PAGE_OPTIONS.map((o) => [o.value, o.label]));

// ═══════════════════════════════════════════════════════════════════════════
//  MASTERS ACCESS TREE DATA
// ═══════════════════════════════════════════════════════════════════════════
const perm = (parentKey, label) => ({
  title: label,
  key: `${parentKey}-${label.replace(/[\s/]/g, '_').toLowerCase()}`,
});

const leaf = (parentKey, label, perms) => ({
  title: label,
  key: `${parentKey}-${label.replace(/[\s&]/g, '_').toLowerCase()}`,
  children: perms.map((p) => perm(`${parentKey}-${label.replace(/[\s&]/g, '_').toLowerCase()}`, p)),
});

const stdPerms     = ['Read', 'Create/Edit/Delete'];
const dlPerms      = ['Read', 'Create/Edit/Delete', 'Download'];
const bomPerms     = ['Read', 'Create/Edit/Delete', 'Download', 'Read BOM', 'Create/Edit/Delete BOM', 'Download BOM'];
const approvalPerms = ['Read', 'Approve/Reject'];

// ── Mold Management Access tree (matches sidebar "Mold Management" module) ──
const moldTreeData = [
  { title: 'Mold Master',        key: 'mold-master',          children: stdPerms.map((p) => perm('mold-master', p)) },
  { title: 'Cavity Tracking',    key: 'mold-cavities',        children: stdPerms.map((p) => perm('mold-cavities', p)) },
  { title: 'Shot Count',         key: 'mold-shot_count',      children: stdPerms.map((p) => perm('mold-shot_count', p)) },
  { title: 'Life Management',    key: 'mold-life_management', children: stdPerms.map((p) => perm('mold-life_management', p)) },
  { title: 'Issue / Return',     key: 'mold-issue_return',    children: stdPerms.map((p) => perm('mold-issue_return', p)) },
  { title: 'Mold Store',         key: 'mold-store_dashboard', children: stdPerms.map((p) => perm('mold-store_dashboard', p)) },
  { title: 'PM Schedule',        key: 'mold-pm',              children: stdPerms.map((p) => perm('mold-pm', p)) },
  { title: 'Repair',             key: 'mold-repair',          children: stdPerms.map((p) => perm('mold-repair', p)) },
  { title: 'Trials',             key: 'mold-trial',           children: stdPerms.map((p) => perm('mold-trial', p)) },
  { title: 'Cost Tracking',      key: 'mold-cost',            children: dlPerms.map((p) => perm('mold-cost', p)) },
  { title: 'Documents',          key: 'mold-documents',       children: dlPerms.map((p) => perm('mold-documents', p)) },
  { title: 'AI Insights',        key: 'mold-ai_insights',     children: stdPerms.map((p) => perm('mold-ai_insights', p)) },
  { title: 'Mold Selection',     key: 'mold-selection',       children: stdPerms.map((p) => perm('mold-selection', p)) },
];

const mastersTreeData = [
  {
    title: 'Sites',
    key: 'sites',
    icon: <SettingOutlined />,
    children: [
      leaf('sites', 'Configuration',       stdPerms),
      leaf('sites', 'Employees & Access',  stdPerms),
      leaf('sites', 'Shifts & Leaves',     stdPerms),
      leaf('sites', 'Integrations',        stdPerms),
      leaf('sites', 'Costing',             stdPerms),
    ],
  },
  {
    title: 'Production',
    key: 'production',
    icon: <ToolOutlined />,
    children: [
      leaf('production', 'Machines',            stdPerms),
      leaf('production', 'Items',               bomPerms),
      leaf('production', 'Cycle Time Rules',    dlPerms),
      leaf('production', 'Tools',               stdPerms),
      leaf('production', 'Downtime',            stdPerms),
      leaf('production', 'Quality',             stdPerms),
      leaf('production', 'Production Forms',    stdPerms)
    ],
  },
  {
    title: 'Planning',
    key: 'planning',
    icon: <ApartmentOutlined />,
    children: [
      leaf('planning', 'Customers',         dlPerms),
      leaf('planning', 'Vendors',           dlPerms),
      leaf('planning', 'Sticker Templates', dlPerms),
    ],
  },
  {
    title: 'Inventory',
    key: 'inventory',
    icon: <InboxOutlined />,
    children: [
      leaf('inventory', 'Warehouses',    stdPerms),
      leaf('inventory', 'Packages',      stdPerms),
      leaf('inventory', 'Custom Fields', stdPerms),
    ],
  },
  {
    title: 'Other',
    key: 'other',
    icon: <MoreOutlined />,
    children: [
      leaf('other', 'Reports',         stdPerms),
      leaf('other', 'Tag Management',  stdPerms),
      leaf('other', 'Templates',       stdPerms),
      leaf('other', 'Automation',      stdPerms),
      leaf('other', 'Onboarding',      stdPerms),
    ],
  },
];

// ── Quality & NPD Access tree ────────────────────────────────────────────────
const qualityTreeData = [
  {
    title: 'Quality Control',
    key: 'quality',
    icon: <CheckCircleOutlined />,
    children: [
      leaf('quality', 'CAPA',       stdPerms),
      leaf('quality', 'NCR',        stdPerms),
      leaf('quality', 'Complaints', stdPerms),
    ],
  },
  {
    title: 'NPD / Documents',
    key: 'npd',
    children: [
      leaf('npd', 'Drawings',     dlPerms),
      leaf('npd', 'Check Sheets', stdPerms),
      leaf('npd', 'PFMEA',        stdPerms),
    ],
  },
];

// ── Store Access tree (from actual app structure) ───────────────────────────
const storeTreeData = [
  {
    title: 'Requests',
    key: 'store-requests',
    children: [
      leaf('store-requests', 'Material Request',  stdPerms),
      leaf('store-requests', 'Issue Request',     stdPerms),
      leaf('store-requests', 'Transfer Request',  stdPerms),
    ],
  },
  {
    title: 'Approval',
    key: 'store-approval',
    children: [
      leaf('store-approval', 'Request Approval',  ['Read', 'Approve/Reject']),
      leaf('store-approval', 'GRN Approval',      ['Read', 'Approve/Reject']),
    ],
  },
  {
    title: 'Transactions View',
    key: 'store-transactions',
    children: [
      leaf('store-transactions', 'GRN',               stdPerms),
      leaf('store-transactions', 'Issue Slip',         stdPerms),
      leaf('store-transactions', 'Material Transfer',  stdPerms),
      leaf('store-transactions', 'Material Returns',   stdPerms),
    ],
  },
  {
    title: 'Inventory View',
    key: 'store-inventory',
    children: [
      leaf('store-inventory', 'Stock Ledger',      ['Read', 'Download']),
      leaf('store-inventory', 'Stock Adjustment',  stdPerms),
      leaf('store-inventory', 'Stock Report',      ['Read', 'Download']),
    ],
  },
  {
    title: 'Downloads',
    key: 'store-downloads',
    children: [
      leaf('store-downloads', 'GRN Report',        ['Read', 'Download']),
      leaf('store-downloads', 'Issue Report',       ['Read', 'Download']),
      leaf('store-downloads', 'Transfer Report',    ['Read', 'Download']),
    ],
  },
  {
    title: 'Shipment',
    key: 'store-shipment',
    children: [
      leaf('store-shipment', 'Inward Shipment',  stdPerms),
      leaf('store-shipment', 'Outward Shipment', stdPerms),
    ],
  },
  {
    title: 'Material Conversion',
    key: 'store-conversion',
    children: [
      leaf('store-conversion', 'Create Conversion',  stdPerms),
      leaf('store-conversion', 'Conversion History', ['Read', 'Download']),
    ],
  },
];

const productionTreeData = [
  {
    title: 'Dashboard',
    key: 'prod-dashboard',
    children: [
      leaf('prod-dashboard', 'Production Overview',  ['Read']),
      leaf('prod-dashboard', 'Machine Status',        ['Read']),
      leaf('prod-dashboard', 'Shift Summary',         ['Read', 'Download']),
    ],
  },
  {
    title: 'DPR',
    key: 'prod-dpr',
    children: [
      leaf('prod-dpr', 'Daily Production Report',  stdPerms),
      leaf('prod-dpr', 'Rejection Entry',          stdPerms),
      leaf('prod-dpr', 'Rework Entry',             stdPerms),
      leaf('prod-dpr', 'Download DPR',             ['Read', 'Download']),
    ],
  },
  {
    title: 'MRP/Expected Production',
    key: 'prod-mrp_expected_production',
    children: [
      leaf('prod-mrp_expected_production', 'View Plan',     ['Read']),
      leaf('prod-mrp_expected_production', 'Create Plan',   stdPerms),
      leaf('prod-mrp_expected_production', 'Download Plan', ['Read', 'Download']),
    ],
  },
  {
    title: 'Production Reports',
    key: 'prod-reports',
    children: [
      leaf('prod-reports', 'Shift Report',      ['Read', 'Download']),
      leaf('prod-reports', 'Machine Report',     ['Read', 'Download']),
      leaf('prod-reports', 'Rejection Report',   ['Read', 'Download']),
      leaf('prod-reports', 'Efficiency Report',  ['Read', 'Download']),
    ],
  },
  {
    title: 'Work Centre',
    key: 'prod-work_centre',
    children: [
      leaf('prod-work_centre', 'View Work Centre',   ['Read']),
      leaf('prod-work_centre', 'Manage Work Centre',  stdPerms),
    ],
  },
  {
    title: 'Item Tracker',
    key: 'prod-itemtracker',
    children: [
      leaf('prod-itemtracker', 'Track Items',     ['Read']),
      leaf('prod-itemtracker', 'Item History',     ['Read', 'Download']),
    ],
  },
  {
    title: 'Tool Tracker',
    key: 'prod-tooltracker',
    children: [
      leaf('prod-tooltracker', 'Track Tools',     ['Read']),
      leaf('prod-tooltracker', 'Tool History',     ['Read', 'Download']),
      leaf('prod-tooltracker', 'Manage Tools',     stdPerms),
    ],
  },
  {
    title: 'Conversion Tracker',
    key: 'prod-conversion',
    children: [
      leaf('prod-conversion', 'View Conversions',   ['Read']),
      leaf('prod-conversion', 'Manage Conversions',  stdPerms),
      leaf('prod-conversion', 'Download Report',     ['Read', 'Download']),
    ],
  },
  {
    title: 'Quality Level',
    key: 'prod-quality_level',
    children: [
      leaf('prod-quality_level', 'IQC',    stdPerms),
      leaf('prod-quality_level', 'PQC',    stdPerms),
      leaf('prod-quality_level', 'OQC',    stdPerms),
      leaf('prod-quality_level', 'CAPA',   stdPerms),
    ],
  },
  {
    title: 'Maintenance',
    key: 'prod-maintenance',
    children: [
      leaf('prod-maintenance', 'Preventive Maintenance',  stdPerms),
      leaf('prod-maintenance', 'Breakdown Maintenance',   stdPerms),
      leaf('prod-maintenance', 'Downtime Log',            stdPerms),
    ],
  },
  {
    title: 'Machines',
    key: 'prod-machines',
    children: [
      leaf('prod-machines', 'Machine List',      ['Read']),
      leaf('prod-machines', 'Manage Machines',    stdPerms),
      leaf('prod-machines', 'Machine Schedule',   stdPerms),
      leaf('prod-machines', 'Downtime History',   ['Read', 'Download']),
    ],
  },
];

// ── Orders Access tree (matches sidebar "Orders" top-level module) ──────────
const ordersTreeData = [
  {
    title: 'Orders',
    key: 'plan-orders',
    children: [
      leaf('plan-orders', 'RFQ',            stdPerms),
      leaf('plan-orders', 'Quotation',      stdPerms),
      leaf('plan-orders', 'Customer PO',    stdPerms),
      leaf('plan-orders', 'Order Tracking', ['Read', 'Download']),
    ],
  },
  {
    title: 'Sales Order',
    key: 'plan-sales-order',
    children: [
      leaf('plan-sales-order', 'Create Sales Order',   stdPerms),
      leaf('plan-sales-order', 'Sales Order History',  ['Read', 'Download']),
    ],
  },
];

// ── Procurement Access tree (matches sidebar "Procurement" top-level module) ─
const procurementTreeData = [
  {
    title: 'Purchase Order',
    key: 'plan-po',
    children: [
      leaf('plan-po', 'Create PO',   stdPerms),
      leaf('plan-po', 'Approve PO',  ['Read', 'Approve/Reject']),
      leaf('plan-po', 'PO Reports',  ['Read', 'Download']),
    ],
  },
  {
    title: 'Subcontracting',
    key: 'plan-subcontracting',
    children: [
      leaf('plan-subcontracting', 'Outward Challan',  stdPerms),
      leaf('plan-subcontracting', 'Inward Challan',   stdPerms),
      leaf('plan-subcontracting', 'Download',         ['Read', 'Download']),
    ],
  },
  {
    title: 'Customer / Vendor',
    key: 'plan-customer-vendor',
    children: [
      leaf('plan-customer-vendor', 'Customers',  stdPerms),
      leaf('plan-customer-vendor', 'Vendors',    stdPerms),
    ],
  },
  {
    title: 'Scheduling',
    key: 'plan-scheduling',
    children: [
      leaf('plan-scheduling', 'Production Plan',  stdPerms),
      leaf('plan-scheduling', 'Dispatch Plan',    stdPerms),
    ],
  },
  {
    title: 'Production Board',
    key: 'plan-production-board',
    children: [
      leaf('plan-production-board', 'View Board',   ['Read']),
      leaf('plan-production-board', 'Manage Board',  stdPerms),
    ],
  },
  {
    title: 'Daily Production Plan',
    key: 'plan-dpp',
    children: [
      leaf('plan-dpp', 'Create Plan',    stdPerms),
      leaf('plan-dpp', 'Download Plan',  ['Read', 'Download']),
    ],
  },
  {
    title: 'Capacity Planning',
    key: 'plan-capacity',
    children: [
      leaf('plan-capacity', 'View Capacity',   ['Read']),
      leaf('plan-capacity', 'Manage Capacity',  stdPerms),
    ],
  },
  {
    title: 'Dispatch',
    key: 'plan-dispatch',
    children: [
      leaf('plan-dispatch', 'Create Dispatch',   stdPerms),
      leaf('plan-dispatch', 'Dispatch History',  ['Read', 'Download']),
    ],
  },
  {
    title: 'Receipt Planning',
    key: 'plan-receipt',
    children: [
      leaf('plan-receipt', 'Create Receipt Plan',   stdPerms),
      leaf('plan-receipt', 'Receipt History',        ['Read', 'Download']),
    ],
  },
  {
    title: 'Indent',
    key: 'plan-indent',
    children: [
      leaf('plan-indent', 'Create Indent',   stdPerms),
      leaf('plan-indent', 'Indent History',  ['Read', 'Download']),
      leaf('plan-indent', 'Approve Indent',  ['Read', 'Approve/Reject']),
    ],
  },
  {
    title: 'SCAR',
    key: 'plan-scar',
    children: [
      leaf('plan-scar', 'SCAR', stdPerms),
    ],
  },
  {
    title: 'BOM Explosion',
    key: 'plan-bom-explosion',
    children: [
      leaf('plan-bom-explosion', 'BOM Explosion', ['Read']),
    ],
  },
  {
    title: 'Supplier Scorecard',
    key: 'plan-supplier-scorecard',
    children: [
      leaf('plan-supplier-scorecard', 'Supplier Scorecard', ['Read']),
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  INFO ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const InfoRow = ({ icon, label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
    <div
      style={{
        width: 36, height: 36, borderRadius: 8,
        background: `${color || '#1d4ed8'}10`,
        border: `1px solid ${color || '#1d4ed8'}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color || '#1d4ed8', fontSize: 15, flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', lineHeight: 1.2 }}>{label}</Text>
      <Text style={{ fontSize: 13, color: '#111827', fontWeight: 500, display: 'block', marginTop: 2 }}>
        {value || <span style={{ color: '#d1d5db' }}>—</span>}
      </Text>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
//  ACCESS TREE TAB
// ═══════════════════════════════════════════════════════════════════════════
const AccessTreeTab = ({ treeData, checkedKeys, setCheckedKeys, title, description, onSave, saving, canWrite }) => (
  <div>
    <div style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 14, fontWeight: 600, color: '#111827', display: 'block' }}>{title}</Text>
      <Text style={{ fontSize: 12, color: '#6b7280' }}>{description}</Text>
    </div>
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e8eaed',
        borderRadius: 10,
        padding: '16px 20px',
      }}
    >
      <Tree
        checkable={canWrite}
        showLine={{ showLeafIcon: false }}
        defaultExpandedKeys={[]}
        treeData={treeData}
        checkedKeys={checkedKeys}
        onCheck={canWrite ? (keys) => setCheckedKeys(keys) : undefined}
        style={{ fontSize: 13 }}
      />
    </div>
    {canWrite && (
      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={() => setCheckedKeys([])}>
          Clear All
        </Button>
        <Button
          size="small"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={onSave}
        >
          Save Permissions
        </Button>
      </div>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const EmployeeDetailPage = () => {
  const { id }    = useParams();
  const navigate   = useNavigate();
  const { can }   = usePermissions();
  const canWrite  = can('sites-employees___access-create_edit_delete');

  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form]                = Form.useForm();

  // Reference data for editing
  const [departments, setDepartments] = useState([]);
  const [roles,       setRoles]       = useState([]);
  const [allSites,    setAllSites]    = useState([]);
  const [allWarehouses, setAllWarehouses] = useState([]);
  const [filteredRoles, setFilteredRoles] = useState([]);

  // Access tree checked keys (per tab — mirrors sidebar top-level modules)
  const [mastersChecked,     setMastersChecked]     = useState([]);
  const [storeChecked,       setStoreChecked]       = useState([]);
  const [productionChecked,  setProductionChecked]  = useState([]);
  const [ordersChecked,      setOrdersChecked]      = useState([]);  // sidebar "Orders"
  const [procurementChecked, setProcurementChecked] = useState([]);  // sidebar "Procurement"
  const [qualityChecked,     setQualityChecked]     = useState([]);  // Quality & NPD
  const [moldChecked,        setMoldChecked]        = useState([]);  // Mold Management
  const [savingPerms,        setSavingPerms]        = useState(false);

  // ── Permission key prefix splitters ────────────────────────────────────
  const MASTERS_ROOTS  = ['sites', 'production', 'planning', 'inventory', 'other'];
  const isMastersKey   = (k) => MASTERS_ROOTS.some((r) => k === r || k.startsWith(`${r}-`));
  const isStoreKey     = (k) => k.startsWith('store');
  const isProdKey      = (k) => k.startsWith('prod-');      // prod- ≠ production- (masters)
  const isOrdersKey    = (k) => k.startsWith('plan-orders') || k.startsWith('plan-sales-order');
  const isProcKey      = (k) => k.startsWith('plan-') && !isOrdersKey(k);
  const isQualityKey   = (k) => k.startsWith('quality-') || k.startsWith('npd-');
  const isMoldKey      = (k) => k.startsWith('mold-');

  // ── Fetch employee ─────────────────────────────────────────────────────
  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userApi.getById(id);
      setUser(data);
      // Populate permission trees from DB
      const perms = data?.permissions ?? [];
      setMastersChecked(perms.filter(isMastersKey));
      setStoreChecked(perms.filter(isStoreKey));
      setProductionChecked(perms.filter(isProdKey));
      setOrdersChecked(perms.filter(isOrdersKey));
      setProcurementChecked(perms.filter(isProcKey));
      setQualityChecked(perms.filter(isQualityKey));
      setMoldChecked(perms.filter(isMoldKey));
    } catch (err) {
      message.error(err?.message || 'Failed to load employee details');
    } finally {
      setLoading(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchUser(); }, [fetchUser]);

  // ── Load reference data when editing ───────────────────────────────────
  useEffect(() => {
    if (!editing) return;
    const load = async () => {
      try {
        const [depts, rls, sts, whs] = await Promise.all([
          userApi.getDepartments(),
          userApi.getRoles(),
          userApi.getSites(),
          userApi.getWarehouses(),
        ]);
        setDepartments(depts ?? []);
        setRoles(rls ?? []);
        setAllSites(sts ?? []);
        setAllWarehouses(whs ?? []);

        // Pre-filter roles for current department
        if (user?.department_id) {
          setFilteredRoles((rls ?? []).filter((r) => r.department_id === user.department_id));
        }
      } catch (err) {
        message.error(err?.message || 'Failed to load reference data');
      }
    };
    load();
  }, [editing, user?.department_id]);

  // ── Start editing ──────────────────────────────────────────────────────
  const startEdit = () => {
    form.setFieldsValue({
      phone:         user.phone || '',
      email:         user.email || '',
      department_id: user.department_id,
      role_id:       user.role_id,
      site_ids:      user.Sites?.map((s) => s.id) || [],
      warehouse_ids: user.Warehouses?.map((w) => w.id) || [],
      landing_page:  user.landing_page || 'dashboard',
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    form.resetFields();
  };

  // ── Save permissions ───────────────────────────────────────────────────
  const handleSavePermissions = async () => {
    setSavingPerms(true);
    try {
      const permissions = [
        ...mastersChecked,
        ...storeChecked,
        ...productionChecked,
        ...ordersChecked,
        ...procurementChecked,
        ...qualityChecked,
        ...moldChecked,
      ];
      await userApi.update(id, { permissions });
      message.success(
        `Permissions saved. ${user?.name ?? 'The user'} has been signed out and will need to log in again to apply the new permissions.`,
        6,
      );
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSavingPerms(false);
    }
  };

  // ── Save edits ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // validation errors shown inline
    }
    setSaving(true);
    try {
      await userApi.update(id, values);
      message.success('Employee updated successfully');
      setEditing(false);
      fetchUser();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────
  const deptColor = DEPT_COLORS[user?.Department?.code] || '#1d4ed8';
  const initials  = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '';

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={() => navigate('/masters/employees')}
          style={{ marginBottom: 16, color: '#6b7280' }}
        >
          Back to Employees
        </Button>
        <Skeleton active paragraph={{ rows: 10 }} />
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={() => navigate('/masters/employees')}
          style={{ marginBottom: 16, color: '#6b7280' }}
        >
          Back to Employees
        </Button>
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <UserOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <Title level={4} style={{ color: '#6b7280' }}>Employee not found</Title>
        </div>
      </AppLayout>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  EMPLOYEE DETAILS TAB
  // ═════════════════════════════════════════════════════════════════════════
  const DetailsTab = () => (
    <div>
      {/* Header card with avatar + quick info */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e8eaed',
          borderRadius: 12,
          padding: '24px 28px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <Avatar
          size={64}
          style={{
            background: deptColor,
            fontSize: 24,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Title level={4} style={{ margin: 0, color: '#111827' }}>{user.name}</Title>
            <Tag
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                fontWeight: 600,
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                color: '#374151',
              }}
            >
              {user.employee_id}
            </Tag>
            {user.is_active ? (
              <Badge status="success" text={<Text style={{ color: '#16a34a', fontSize: 12, fontWeight: 500 }}>Active</Text>} />
            ) : (
              <Badge status="error" text={<Text style={{ color: '#dc2626', fontSize: 12, fontWeight: 500 }}>Inactive</Text>} />
            )}
          </div>
          <Text style={{ color: '#6b7280', fontSize: 13, display: 'block', marginTop: 4 }}>
            {user.Department?.name || '—'} · {user.Role?.label || '—'}
          </Text>
        </div>
        {!editing ? (
          canWrite && (
            <Button
              icon={<EditOutlined />}
              onClick={startEdit}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Edit
            </Button>
          )
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={<CloseOutlined />} onClick={cancelEdit} style={{ borderRadius: 8 }}>
              Cancel
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Detail fields */}
      {!editing ? (
        <Row gutter={20}>
          <Col xs={24} md={12}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e8eaed',
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9ca3af',
                  letterSpacing: '0.06em',
                  display: 'block',
                  marginBottom: 16,
                }}
              >
                CONTACT INFORMATION
              </Text>
              <InfoRow
                icon={<PhoneOutlined />}
                label="Mobile Number"
                value={user.phone}
                color="#7c3aed"
              />
              <InfoRow
                icon={<MailOutlined />}
                label="Email Address"
                value={user.email}
                color="#0d9488"
              />
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e8eaed',
                borderRadius: 12,
                padding: '20px 24px',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9ca3af',
                  letterSpacing: '0.06em',
                  display: 'block',
                  marginBottom: 16,
                }}
              >
                DEPARTMENT & ROLE
              </Text>
              <InfoRow
                icon={<TeamOutlined />}
                label="Department"
                value={
                  user.Department ? (
                    <Tag
                      style={{
                        background: `${deptColor}12`,
                        border: `1px solid ${deptColor}40`,
                        color: deptColor,
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {user.Department.name}
                    </Tag>
                  ) : null
                }
                color={deptColor}
              />
              <InfoRow
                icon={<SafetyCertificateOutlined />}
                label="Role"
                value={user.Role?.label}
                color="#d97706"
              />
            </div>
          </Col>

          <Col xs={24} md={12}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e8eaed',
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9ca3af',
                  letterSpacing: '0.06em',
                  display: 'block',
                  marginBottom: 16,
                }}
              >
                SITE & WAREHOUSE ACCESS
              </Text>
              <InfoRow
                icon={<HomeOutlined />}
                label="Assigned Sites"
                value={
                  user.Sites?.length ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {user.Sites.map((s) => (
                        <Tag key={s.id} style={{ fontSize: 11, borderRadius: 20 }}>
                          {s.name}
                        </Tag>
                      ))}
                    </div>
                  ) : null
                }
                color="#1d4ed8"
              />
              <InfoRow
                icon={<BankOutlined />}
                label="Assigned Warehouses"
                value={
                  user.Warehouses?.length ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {user.Warehouses.map((w) => (
                        <Tag key={w.id} style={{ fontSize: 11, borderRadius: 20 }}>
                          {w.name}
                        </Tag>
                      ))}
                    </div>
                  ) : null
                }
                color="#7c3aed"
              />
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e8eaed',
                borderRadius: 12,
                padding: '20px 24px',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9ca3af',
                  letterSpacing: '0.06em',
                  display: 'block',
                  marginBottom: 16,
                }}
              >
                PREFERENCES
              </Text>
              <InfoRow
                icon={<AppstoreOutlined />}
                label="Landing Page"
                value={LANDING_PAGE_MAP[user.landing_page] || user.landing_page || 'Dashboard'}
                color="#16a34a"
              />
              <InfoRow
                icon={<CheckCircleOutlined />}
                label="First Login"
                value={
                  user.is_first_login ? (
                    <Tag color="orange" style={{ fontSize: 11 }}>Password change pending</Tag>
                  ) : (
                    <Tag color="green" style={{ fontSize: 11 }}>Completed</Tag>
                  )
                }
                color="#d97706"
              />
            </div>
          </Col>
        </Row>
      ) : (
        /* ── Edit mode form ─────────────────────────────────────────────── */
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e8eaed',
            borderRadius: 12,
            padding: '24px 28px',
          }}
        >
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            size="large"
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#9ca3af',
                letterSpacing: '0.06em',
                display: 'block',
                marginBottom: 16,
              }}
            >
              CONTACT INFORMATION
            </Text>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="phone"
                  label={<span style={{ fontSize: 13, fontWeight: 500 }}>Mobile</span>}
                >
                  <Input placeholder="e.g. 9876543210" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="email"
                  label={<span style={{ fontSize: 13, fontWeight: 500 }}>Email</span>}
                  rules={[
                    { required: true, message: 'Email is required' },
                    { type: 'email', message: 'Enter a valid email' },
                  ]}
                >
                  <Input placeholder="priya@dynatech.com" />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '8px 0 16px' }} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#9ca3af',
                letterSpacing: '0.06em',
                display: 'block',
                marginBottom: 16,
              }}
            >
              DEPARTMENT & ROLE
            </Text>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="department_id"
                  label={<span style={{ fontSize: 13, fontWeight: 500 }}>Department</span>}
                  rules={[{ required: true, message: 'Select department' }]}
                >
                  <Select
                    placeholder="Select department"
                    showSearch
                    optionFilterProp="label"
                    options={departments.map((d) => ({ value: d.id, label: d.name }))}
                    onChange={(val) => {
                      setFilteredRoles(roles.filter((r) => r.department_id === val));
                      form.setFieldValue('role_id', undefined);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="role_id"
                  label={<span style={{ fontSize: 13, fontWeight: 500 }}>Role</span>}
                  rules={[{ required: true, message: 'Select role' }]}
                >
                  <Select
                    placeholder="Select role"
                    showSearch
                    optionFilterProp="label"
                    options={filteredRoles.map((r) => ({ value: r.id, label: r.label }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '8px 0 16px' }} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#9ca3af',
                letterSpacing: '0.06em',
                display: 'block',
                marginBottom: 16,
              }}
            >
              SITE & WAREHOUSE ACCESS
            </Text>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="site_ids"
                  label={<span style={{ fontSize: 13, fontWeight: 500 }}>Sites</span>}
                >
                  <Select
                    mode="multiple"
                    placeholder="Select sites…"
                    showSearch
                    optionFilterProp="label"
                    maxTagCount="responsive"
                    options={allSites.map((s) => ({ value: s.id, label: s.name }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="warehouse_ids"
                  label={<span style={{ fontSize: 13, fontWeight: 500 }}>Warehouses</span>}
                >
                  <Select
                    mode="multiple"
                    placeholder="Select warehouses…"
                    showSearch
                    optionFilterProp="label"
                    maxTagCount="responsive"
                    options={allWarehouses.map((w) => ({ value: w.id, label: w.name }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '8px 0 16px' }} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#9ca3af',
                letterSpacing: '0.06em',
                display: 'block',
                marginBottom: 16,
              }}
            >
              PREFERENCES
            </Text>
            <Form.Item
              name="landing_page"
              label={<span style={{ fontSize: 13, fontWeight: 500 }}>Landing Page</span>}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={LANDING_PAGE_OPTIONS}
                style={{ maxWidth: 320 }}
              />
            </Form.Item>
          </Form>
        </div>
      )}
    </div>
  );

  // ═════════════════════════════════════════════════════════════════════════
  //  TABS CONFIG
  // ═════════════════════════════════════════════════════════════════════════
  const tabItems = [
    {
      key:   'details',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <UserOutlined /> Employee Details
        </span>
      ),
      children: <DetailsTab />,
    },
    {
      key:   'masters',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SettingOutlined /> Masters Access
        </span>
      ),
      children: (
        <AccessTreeTab
          treeData={mastersTreeData}
          checkedKeys={mastersChecked}
          setCheckedKeys={setMastersChecked}
          title="Masters Access Permissions"
          description="Control what master data this employee can view or manage across sites, production, planning, inventory and other modules."
          onSave={handleSavePermissions}
          saving={savingPerms}
          canWrite={canWrite}
        />
      ),
    },
    {
      key:   'store',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShopOutlined /> Store Access
        </span>
      ),
      children: (
        <AccessTreeTab
          treeData={storeTreeData}
          checkedKeys={storeChecked}
          setCheckedKeys={setStoreChecked}
          title="Store Access Permissions"
          description="Control access to store operations — GRN, issue slips, material transfers and stock ledger."
          onSave={handleSavePermissions}
          saving={savingPerms}
          canWrite={canWrite}
        />
      ),
    },
    {
      key:   'production',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ToolOutlined /> Production Access
        </span>
      ),
      children: (
        <AccessTreeTab
          treeData={productionTreeData}
          checkedKeys={productionChecked}
          setCheckedKeys={setProductionChecked}
          title="Production Access Permissions"
          description="Control access to daily production, rejection, rework entries and job work challans."
          onSave={handleSavePermissions}
          saving={savingPerms}
          canWrite={canWrite}
        />
      ),
    },
    {
      key:   'orders',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SolutionOutlined /> Orders Access
        </span>
      ),
      children: (
        <AccessTreeTab
          treeData={ordersTreeData}
          checkedKeys={ordersChecked}
          setCheckedKeys={setOrdersChecked}
          title="Orders Access Permissions"
          description="Control access to RFQ, quotations, customer purchase orders and order tracking."
          onSave={handleSavePermissions}
          saving={savingPerms}
          canWrite={canWrite}
        />
      ),
    },
    {
      key:   'procurement',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShoppingCartOutlined /> Procurement Access
        </span>
      ),
      children: (
        <AccessTreeTab
          treeData={procurementTreeData}
          checkedKeys={procurementChecked}
          setCheckedKeys={setProcurementChecked}
          title="Procurement Access Permissions"
          description="Control access to purchase orders, subcontracting challans, scheduling and capacity planning."
          onSave={handleSavePermissions}
          saving={savingPerms}
          canWrite={canWrite}
        />
      ),
    },
    {
      key:   'quality',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircleOutlined /> Quality &amp; NPD
        </span>
      ),
      children: (
        <AccessTreeTab
          treeData={qualityTreeData}
          checkedKeys={qualityChecked}
          setCheckedKeys={setQualityChecked}
          title="Quality & NPD Access Permissions"
          description="Control access to CAPA, NCR, customer complaints, engineering drawings, check sheets and PFMEA."
          onSave={handleSavePermissions}
          saving={savingPerms}
          canWrite={canWrite}
        />
      ),
    },
    {
      key:   'mold',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ToolOutlined /> Mold Management
        </span>
      ),
      children: (
        <AccessTreeTab
          treeData={moldTreeData}
          checkedKeys={moldChecked}
          setCheckedKeys={setMoldChecked}
          title="Mold Management Access Permissions"
          description="Control access to mold master, cavity tracking, shot count, life management, issue/return, store, PM, repair, trials, cost, documents, AI insights and mold selection."
          onSave={handleSavePermissions}
          saving={savingPerms}
          canWrite={canWrite}
        />
      ),
    },
  ];

  // ═════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <AppLayout>
      {/* Back button */}
      <Button
        icon={<ArrowLeftOutlined />}
        type="text"
        onClick={() => navigate('/masters/employees')}
        style={{ marginBottom: 12, color: '#6b7280', fontWeight: 500, paddingLeft: 0 }}
      >
        Back to Employees
      </Button>

      {/* Page heading */}
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Employee Details
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Masters · Employees &amp; Access · {user.name} ({user.employee_id})
        </Text>
      </div>

      {/* Tabs */}
      <Tabs
        defaultActiveKey="details"
        items={tabItems}
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e8eaed',
          padding: '8px 20px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
      />
    </AppLayout>
  );
};

export default EmployeeDetailPage;
