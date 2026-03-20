import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme as antTheme } from 'antd';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/Login';
import ChangePasswordPage from './pages/ChangePassword';
import DashboardPage from './pages/Dashboard';
import ProfilePage from './pages/Profile';
import ResetPasswordPage from './pages/Admin/ResetPassword';
import ControlRoomPage from './pages/Admin/ControlRoom';
import EmployeesPage      from './pages/Masters/Employees';
import EmployeeDetailPage from './pages/Masters/Employees/EmployeeDetail';
import ConfigurationPage  from './pages/Masters/Configuration';
import AddSitePage        from './pages/Masters/Configuration/AddSite';
import EditSitePage       from './pages/Masters/Configuration/EditSite';
import ShiftsPage         from './pages/Masters/Shifts';
import WarehousesPage     from './pages/Masters/Warehouses';
import MachinesPage       from './pages/Production/Machines';
import WorkCentersPage    from './pages/Masters/WorkCenters';
import RoutingsPage       from './pages/Masters/Routings';
import ItemsPage          from './pages/Production/Items';
import CycleTimeRulesPage from './pages/Production/CycleTimeRules';
import DowntimePage       from './pages/Production/Downtime';
import CTQPage            from './pages/Quality/CTQ';
import TagManagementPage  from './pages/Masters/TagManagement';
import VendorsPage          from './pages/Masters/Planning/Vendors';
import CustomersPage        from './pages/Masters/Planning/Customers';
import StickerTemplatesPage from './pages/Masters/Planning/StickerTemplates';
import CostingPage          from './pages/Masters/Costing';
import CustomFieldsPage     from './pages/Masters/Inventory/CustomFields';
import PackagesPage         from './pages/Masters/Inventory/Packages';
import IntegrationsPage     from './pages/Masters/Integrations';
import TemplatesPage        from './pages/Masters/Other/Templates';
import ReportsPage          from './pages/Masters/Other/Reports';
import ProductionFormsPage  from './pages/Production/ProductionForms';
import ToolsPage            from './pages/Production/Tools';
import RFQPage              from './pages/Orders/RFQ';
import QuotationPage        from './pages/Orders/Quotation';
import CustomerPOPage       from './pages/Orders/CustomerPO';
import OrderDetailPage      from './pages/Orders/CustomerPO/OrderDetail';
import OrderTrackingPage    from './pages/Orders/Tracking';
import GRNPage              from './pages/Store/GRN';
import MaterialRequestPage  from './pages/Store/MaterialRequest';
import IssueSlipPage        from './pages/Store/IssueSlip';
import StockLedgerPage      from './pages/Store/StockLedger';
import StockAdjustmentPage  from './pages/Store/StockAdjustment';
import WorkOrdersPage        from './pages/Production/WorkOrders';
import JobCardsPage          from './pages/Production/JobCards';
import TimeStandardsPage    from './pages/Production/TimeStandards';
import ShiftPlanningPage    from './pages/Production/ShiftPlanning';
import LQCPage               from './pages/Production/LQC';
import IQCPage               from './pages/Production/IQC';
import IQCDetailPage         from './pages/Production/IQC/IQCDetail';
import PQCPage               from './pages/Production/PQC';
import OQCPage               from './pages/Production/OQC';
import SchedulingPage        from './pages/Production/Scheduling';
import CapacityPlanningPage  from './pages/Production/CapacityPlanning';
import ScrapVoucherPage      from './pages/Production/ScrapVoucher';
import ProcurementAnalyticsPage from './pages/Procurement/Analytics';
import BudgetManagementPage     from './pages/Procurement/BudgetManagement';
import VendorInvoicesPage       from './pages/Procurement/VendorInvoices';
import PurchaseReturnsPage      from './pages/Procurement/PurchaseReturns';
import PurchaseRequisitionsPage from './pages/Procurement/PurchaseRequisitions';
import VendorRFQPage            from './pages/Procurement/VendorRFQ';
import PurchaseOrdersPage       from './pages/Procurement/PurchaseOrders';
import BOMExplosionPage      from './pages/Procurement/BOMExplosion';
import SupplierScorecardPage from './pages/Procurement/SupplierScorecard';
import SCARPage              from './pages/Procurement/SCAR';
import OutwardChallanPage    from './pages/Subcontracting/OutwardChallan';
import InwardChallanPage     from './pages/Subcontracting/InwardChallan';
import TrainingTopicsPage   from './pages/HR/TrainingTopics';
import RoleRequirementsPage from './pages/HR/RoleRequirements';
import TrainingRecordsPage  from './pages/HR/TrainingRecords';
import CompetencyMatrixPage from './pages/HR/CompetencyMatrix';
import EffectivenessPage    from './pages/HR/Effectiveness';
import CAPAPage             from './pages/Quality/CAPA';
import CAPADetailPage       from './pages/Quality/CAPA/CAPADetail';
import NCRPage              from './pages/Quality/NCR';
import NCRDetailPage        from './pages/Quality/NCR/NCRDetail';
import ComplaintsPage       from './pages/Quality/Complaints';
import ComplaintDetailPage  from './pages/Quality/Complaints/ComplaintDetail';
import DrawingsPage         from './pages/NPD/Drawings';
import DrawingDetailPage    from './pages/NPD/Drawings/DrawingDetail';
import CheckSheetsPage      from './pages/NPD/CheckSheets';
import CheckSheetDetailPage from './pages/NPD/CheckSheets/CheckSheetDetail';
import PFMEAPage            from './pages/NPD/PFMEA';
import PFMEADetailPage      from './pages/NPD/PFMEA/PFMEADetail';
import TransportersPage     from './pages/Dispatch/Transporters';
import DispatchOrdersPage   from './pages/Dispatch/DispatchOrders';
import DeliveryChallansPage from './pages/Dispatch/DeliveryChallans';
import ShipmentTrackingPage from './pages/Dispatch/ShipmentTracking';
import DispatchReportsPage  from './pages/Dispatch/Reports';
import DispatchDocumentsPage from './pages/Dispatch/DispatchDocuments';
import TallySyncPage        from './pages/Accounts/TallySync';
import SalesInvoicesPage    from './pages/Accounts/SalesInvoices';
import DebitCreditNotesPage from './pages/Accounts/DebitCreditNotes';
import PaymentsPage         from './pages/Accounts/Payments';
import COPQPage             from './pages/Accounts/COPQ';
import InstrumentsPage         from './pages/Quality/Instruments';
import InventoryDashboardPage  from './pages/Store/InventoryDashboard';

// Mold Management — Sprint 3
import MoldMasterPage      from './pages/Mold/MoldMaster';
import MoldDetailPage      from './pages/Mold/MoldMaster/MoldDetail';
import CavityTrackingPage  from './pages/Mold/CavityTracking';
import ShotCountPage       from './pages/Mold/ShotCount';
import LifeManagementPage  from './pages/Mold/LifeManagement';
import IssueReturnPage     from './pages/Mold/IssueReturn';
import StoreDashboardPage  from './pages/Mold/StoreDashboard';
// Mold Management — Sprint 5
import PMSchedulePage      from './pages/Mold/PMSchedule';
import RepairPage          from './pages/Mold/Repair';
import TrialsPage          from './pages/Mold/Trials';
import CostTrackingPage    from './pages/Mold/CostTracking';
import MoldDocumentsPage   from './pages/Mold/Documents';
// Mold Management — Sprint 6 (AI)
import AiInsightsPage      from './pages/Mold/AiInsights';
import MoldSelectionPage   from './pages/Mold/MoldSelection';
// Maintenance
import EquipmentPage        from './pages/Maintenance/Equipment';
import HealthDashboardPage  from './pages/Maintenance/HealthDashboard';
import BreakdownPage        from './pages/Maintenance/Breakdown';
import MntDowntimePage      from './pages/Maintenance/Downtime';
import MntPMSchedulePage    from './pages/Maintenance/PMSchedule';
import MntSparePartsPage    from './pages/Maintenance/SpareParts';
import MntLOTOPage          from './pages/Maintenance/LOTO';
import MntKpiDashboardPage  from './pages/Maintenance/KpiDashboard';
import MadadPage            from './pages/Madad';

// Dynatech ONE — Enterprise White Theme (no linear gradients)
const theme = {
  algorithm: antTheme.defaultAlgorithm,
  token: {
    colorPrimary:    '#1d4ed8',
    colorSuccess:    '#16a34a',
    colorWarning:    '#d97706',
    colorError:      '#dc2626',
    colorBgBase:     '#ffffff',
    colorTextBase:   '#111827',
    colorBgLayout:   '#f4f6f9',
    colorBorder:     '#d1d5db',
    borderRadius:    6,
    fontFamily:      "'Inter', 'Segoe UI', Arial, sans-serif",
    boxShadow:       '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
    colorBgContainer:'#ffffff',
  },
  components: {
    Button: {
      colorPrimary:      '#1d4ed8',
      colorPrimaryHover: '#1e40af',
      algorithm: true,
    },
    Menu: {
      colorItemBg:          'transparent',
      colorItemBgSelected:  '#eff6ff',
      colorItemTextSelected:'#1d4ed8',
      colorItemTextHover:   '#1d4ed8',
      colorItemBgHover:     '#f8fafc',
      borderRadius:          6,
      itemHeight:            34,
      itemMarginBlock:       2,
      groupTitleFontSize:    11,
      groupTitleColor:       '#9ca3af',
    },
    Layout: {
      siderBg:  '#ffffff',
      headerBg: '#ffffff',
      bodyBg:   '#f4f6f9',
      triggerBg:'#f4f6f9',
    },
    Card: {
      colorBgContainer: '#ffffff',
    },
  },
};

function App() {
  return (
    <ConfigProvider theme={theme}>
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/change-password"
                element={
                  <ProtectedRoute>
                    <ChangePasswordPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* SYS-003: Admin password reset — IT Admin / Plant Head only */}
              <Route
                path="/admin/reset-password"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']}>
                    <ResetPasswordPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/control-room"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']}>
                    <ControlRoomPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Employees & Access */}
              <Route
                path="/masters/employees"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']} permission="sites-employees___access-read">
                    <EmployeesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masters/employees/:id"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']} permission="sites-employees___access-read">
                    <EmployeeDetailPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Configuration (Sites) */}
              {/* Any role with sites-configuration-read permission can view the list */}
              <Route
                path="/masters/configuration"
                element={
                  <ProtectedRoute permission="sites-configuration-read">
                    <ConfigurationPage />
                  </ProtectedRoute>
                }
              />
              {/* Add/Edit pages require write permission OR admin role */}
              <Route
                path="/masters/configuration/sites/add"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']} permission="sites-configuration-create_edit_delete">
                    <AddSitePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masters/configuration/sites/:id"
                element={
                  <ProtectedRoute permission="sites-configuration-read">
                    <EditSitePage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Shifts & Leaves */}
              <Route
                path="/masters/shifts"
                element={
                  <ProtectedRoute permission="sites-shifts___leaves-read">
                    <ShiftsPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Inventory — Warehouses */}
              <Route
                path="/masters/inventory/warehouses"
                element={
                  <ProtectedRoute permission="inventory-warehouses-read">
                    <WarehousesPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Production — Machines */}
              <Route
                path="/masters/production/machines"
                element={
                  <ProtectedRoute permission="production-machines-read">
                    <MachinesPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Production — Work Centers */}
              <Route
                path="/masters/production/work-centers"
                element={
                  <ProtectedRoute permission="production-work_centers-read">
                    <WorkCentersPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Production — Routings */}
              <Route
                path="/masters/production/routings"
                element={
                  <ProtectedRoute permission="production-routings-read">
                    <RoutingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Production — Items */}
              <Route
                path="/masters/production/items"
                element={
                  <ProtectedRoute permission="production-items-read">
                    <ItemsPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Production — Production Forms */}
              <Route
                path="/masters/production/production-forms"
                element={
                  <ProtectedRoute permission="production-production_forms-read">
                    <ProductionFormsPage />
                  </ProtectedRoute>
                }
              />
              {/* Masters — Production — Cycle Time Rules */}
              <Route
                path="/masters/production/cycle-time-rules"
                element={
                  <ProtectedRoute permission="production-items-read">
                    <CycleTimeRulesPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Production — Tools */}
              <Route
                path="/masters/production/tools"
                element={
                  <ProtectedRoute permission="production-tools-read">
                    <ToolsPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Production — Downtime */}
              <Route
                path="/masters/production/downtime"
                element={
                  <ProtectedRoute permission="production-downtime-read">
                    <DowntimePage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Production — Quality */}
              <Route
                path="/masters/production/quality"
                element={
                  <ProtectedRoute permission="production-quality-read">
                    <CTQPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Other — Tag Management */}
              <Route
                path="/masters/other/tag-management"
                element={
                  <ProtectedRoute permission="other-tag_management-read">
                    <TagManagementPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Other — Templates */}
              <Route
                path="/masters/other/templates"
                element={
                  <ProtectedRoute permission="other-templates-read">
                    <TemplatesPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Other — Reports */}
              <Route
                path="/masters/other/reports"
                element={
                  <ProtectedRoute permission="other-reports-read">
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              {/* Masters — Planning — Vendors */}
              <Route
                path="/masters/planning/vendors"
                element={
                  <ProtectedRoute permission="planning-vendors-read">
                    <VendorsPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Planning — Customers */}
              <Route
                path="/masters/planning/customers"
                element={
                  <ProtectedRoute permission="planning-vendors-read">
                    <CustomersPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Planning — Sticker Templates */}
              <Route
                path="/masters/planning/sticker-templates"
                element={
                  <ProtectedRoute permission="planning-sticker-templates-read">
                    <StickerTemplatesPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Inventory — Custom Fields */}
              <Route
                path="/masters/inventory/custom-fields"
                element={
                  <ProtectedRoute permission="inventory-custom-fields-read">
                    <CustomFieldsPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Inventory — Packages */}
              <Route
                path="/masters/inventory/packages"
                element={
                  <ProtectedRoute permission="inventory-packages-read">
                    <PackagesPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Sites — Costing */}
              <Route
                path="/masters/costing"
                element={
                  <ProtectedRoute permission="sites-costing-read">
                    <CostingPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Sites — Integrations */}
              <Route
                path="/masters/integrations"
                element={
                  <ProtectedRoute permission="sites-integrations-read">
                    <IntegrationsPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Orders Module ──────────────────────────────────────────── */}
              <Route
                path="/orders/rfq"
                element={
                  <ProtectedRoute permission="plan-orders-rfq-read">
                    <RFQPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/quotation"
                element={
                  <ProtectedRoute permission="plan-orders-quotation-read">
                    <QuotationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/customer-po"
                element={
                  <ProtectedRoute permission="plan-orders-customer_po-read">
                    <CustomerPOPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/customer-po/:id"
                element={
                  <ProtectedRoute permission="plan-orders-customer_po-read">
                    <OrderDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/tracking"
                element={
                  <ProtectedRoute permission="plan-orders-order_tracking-read">
                    <OrderTrackingPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Store Module ────────────────────────────────────────────── */}
              <Route
                path="/store/grn"
                element={
                  <ProtectedRoute permission="store-transactions-grn-read">
                    <GRNPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/store/issue-slip"
                element={
                  <ProtectedRoute permission="store-transactions-issue_slip-read">
                    <IssueSlipPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/store/material-request"
                element={
                  <ProtectedRoute permission="store-requests-material_request-read">
                    <MaterialRequestPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/store/stock-ledger"
                element={
                  <ProtectedRoute permission="store-inventory-stock_ledger-read">
                    <StockLedgerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/store/stock-adjustment"
                element={
                  <ProtectedRoute permission="store-inventory-stock_adjustment-read">
                    <StockAdjustmentPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Production Module ─────────────────────────────────────────── */}
              <Route path="/production/work-orders" element={<ProtectedRoute permission="prod-work_centre-manage_work_centre-read"><WorkOrdersPage /></ProtectedRoute>} />
              <Route path="/production/job-cards" element={<ProtectedRoute permission="prod-dpr-daily_production_report-read"><JobCardsPage /></ProtectedRoute>} />
              <Route path="/production/time-standards" element={<ProtectedRoute permission="prod-time_standards-operations-read"><TimeStandardsPage /></ProtectedRoute>} />
              <Route path="/production/shift-planning" element={<ProtectedRoute permission="prod-shift_planning-manage_shifts-read"><ShiftPlanningPage /></ProtectedRoute>} />
              <Route path="/production/iqc" element={<ProtectedRoute permission="prod-quality_level-iqc-read"><IQCPage /></ProtectedRoute>} />
              <Route path="/production/iqc/:id" element={<ProtectedRoute permission="prod-quality_level-iqc-read"><IQCDetailPage /></ProtectedRoute>} />
              <Route path="/production/lqc" element={<ProtectedRoute permission="prod-quality_level-iqc-read"><LQCPage /></ProtectedRoute>} />
              <Route path="/production/pqc" element={<ProtectedRoute permission="prod-quality_level-pqc-read"><PQCPage /></ProtectedRoute>} />
              <Route path="/production/oqc" element={<ProtectedRoute permission="prod-quality_level-oqc-read"><OQCPage /></ProtectedRoute>} />
              <Route path="/production/scheduling" element={<ProtectedRoute permission="prod-mrp_expected_production-create_plan-read"><SchedulingPage /></ProtectedRoute>} />
              <Route path="/production/capacity-planning" element={<ProtectedRoute permission="prod-dpr-daily_production_report-read"><CapacityPlanningPage /></ProtectedRoute>} />
              <Route path="/production/scrap" element={<ProtectedRoute permission="prod-dpr-rejection_entry-read"><ScrapVoucherPage /></ProtectedRoute>} />

              {/* ── Procurement Module ─────────────────────────────────────────── */}
              <Route path="/procurement/analytics"             element={<ProtectedRoute permission="plan-procurement-analytics-procurement_analytics-read"><ProcurementAnalyticsPage /></ProtectedRoute>} />
              <Route path="/procurement/budget-management"     element={<ProtectedRoute permission="plan-budget-management-budget_management-read"><BudgetManagementPage /></ProtectedRoute>} />
              <Route path="/procurement/vendor-invoices"       element={<ProtectedRoute permission="plan-vendor-invoices-vendor_invoices-read"><VendorInvoicesPage /></ProtectedRoute>} />
              <Route path="/procurement/purchase-returns"      element={<ProtectedRoute permission="plan-purchase-returns-purchase_returns-read"><PurchaseReturnsPage /></ProtectedRoute>} />
              <Route path="/procurement/purchase-requisitions" element={<ProtectedRoute permission="plan-pr-purchase_requisition-read"><PurchaseRequisitionsPage /></ProtectedRoute>} />
              <Route path="/procurement/vendor-rfq"           element={<ProtectedRoute permission="plan-vendor-rfq-vendor_rfq-read"><VendorRFQPage /></ProtectedRoute>} />
              <Route path="/procurement/purchase-orders"       element={<ProtectedRoute permission="plan-po-create_po-read"><PurchaseOrdersPage /></ProtectedRoute>} />
              <Route path="/procurement/bom-explosion"      element={<ProtectedRoute permission="plan-bom-explosion-bom_explosion-read"><BOMExplosionPage /></ProtectedRoute>} />
              <Route path="/procurement/supplier-scorecard" element={<ProtectedRoute permission="plan-supplier-scorecard-supplier_scorecard-read"><SupplierScorecardPage /></ProtectedRoute>} />
              <Route path="/procurement/scar"               element={<ProtectedRoute permission="plan-scar-scar-read"><SCARPage /></ProtectedRoute>} />

              {/* ── Subcontracting Module ──────────────────────────────────────── */}
              <Route path="/subcontracting/outward" element={<ProtectedRoute permission="plan-subcontracting-outward_challan-read"><OutwardChallanPage /></ProtectedRoute>} />
              <Route path="/subcontracting/inward" element={<ProtectedRoute permission="plan-subcontracting-inward_challan-read"><InwardChallanPage /></ProtectedRoute>} />

              {/* ── Quality — Instruments ──────────────────────────────────────── */}
              <Route path="/quality/instruments" element={<ProtectedRoute permission="quality-instruments-read"><InstrumentsPage /></ProtectedRoute>} />

              {/* ── Store — Inventory Dashboard ────────────────────────────────── */}
              <Route path="/store/inventory-dashboard" element={<ProtectedRoute permission="store-inventory-dashboard-read"><InventoryDashboardPage /></ProtectedRoute>} />

              {/* ── Quality & NPD Module ──────────────────────────────────────── */}
              <Route path="/quality/capa"           element={<ProtectedRoute permission="quality-capa-read">         <CAPAPage />           </ProtectedRoute>} />
              <Route path="/quality/capa/:id"        element={<ProtectedRoute permission="quality-capa-read">         <CAPADetailPage />      </ProtectedRoute>} />
              <Route path="/quality/ncr"            element={<ProtectedRoute permission="quality-ncr-read">          <NCRPage />            </ProtectedRoute>} />
              <Route path="/quality/ncr/:id"         element={<ProtectedRoute permission="quality-ncr-read">          <NCRDetailPage />       </ProtectedRoute>} />
              <Route path="/quality/complaints"     element={<ProtectedRoute permission="quality-complaints-read">   <ComplaintsPage />     </ProtectedRoute>} />
              <Route path="/quality/complaints/:id"  element={<ProtectedRoute permission="quality-complaints-read">   <ComplaintDetailPage /> </ProtectedRoute>} />
              <Route path="/quality/drawings"       element={<ProtectedRoute permission="npd-drawings-read">         <DrawingsPage />       </ProtectedRoute>} />
              <Route path="/quality/drawings/:id"    element={<ProtectedRoute permission="npd-drawings-read">         <DrawingDetailPage />   </ProtectedRoute>} />
              <Route path="/quality/check-sheets"   element={<ProtectedRoute permission="npd-check_sheets-read">     <CheckSheetsPage />    </ProtectedRoute>} />
              <Route path="/quality/check-sheets/:id" element={<ProtectedRoute permission="npd-check_sheets-read">   <CheckSheetDetailPage /></ProtectedRoute>} />
              <Route path="/quality/pfmea"          element={<ProtectedRoute permission="npd-pfmea-read">            <PFMEAPage />          </ProtectedRoute>} />
              <Route path="/quality/pfmea/:id"       element={<ProtectedRoute permission="npd-pfmea-read">            <PFMEADetailPage />     </ProtectedRoute>} />

              {/* HR & Training — hr_admin, it_admin, plant_head only */}
              <Route
                path="/hr/training-topics"
                element={
                  <ProtectedRoute roles={['hr_admin', 'it_admin', 'plant_head']}>
                    <TrainingTopicsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/role-requirements"
                element={
                  <ProtectedRoute roles={['hr_admin', 'it_admin', 'plant_head']}>
                    <RoleRequirementsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/training-records"
                element={
                  <ProtectedRoute roles={['hr_admin', 'it_admin', 'plant_head']}>
                    <TrainingRecordsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/competency-matrix"
                element={
                  <ProtectedRoute roles={['hr_admin', 'it_admin', 'plant_head']}>
                    <CompetencyMatrixPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/effectiveness"
                element={
                  <ProtectedRoute roles={['hr_admin', 'it_admin', 'plant_head']}>
                    <EffectivenessPage />
                  </ProtectedRoute>
                }
              />

              {/* Dispatch & Logistics — dispatch_manager, it_admin, plant_head only */}
              <Route
                path="/dispatch/transporters"
                element={
                  <ProtectedRoute roles={['dispatch_manager', 'it_admin', 'plant_head']}>
                    <TransportersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dispatch/orders"
                element={
                  <ProtectedRoute roles={['dispatch_manager', 'it_admin', 'plant_head']}>
                    <DispatchOrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dispatch/orders/:id/documents"
                element={
                  <ProtectedRoute roles={['dispatch_manager', 'it_admin', 'plant_head']}>
                    <DispatchDocumentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dispatch/challans"
                element={
                  <ProtectedRoute roles={['dispatch_manager', 'it_admin', 'plant_head']}>
                    <DeliveryChallansPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dispatch/tracking"
                element={
                  <ProtectedRoute roles={['dispatch_manager', 'it_admin', 'plant_head']}>
                    <ShipmentTrackingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dispatch/reports"
                element={
                  <ProtectedRoute roles={['dispatch_manager', 'it_admin', 'plant_head']}>
                    <DispatchReportsPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Accounts Module ────────────────────────────────────────────── */}
              <Route
                path="/accounts/tally-sync"
                element={
                  <ProtectedRoute roles={['accounts_manager', 'accounts_incharge', 'it_admin', 'plant_head']}>
                    <TallySyncPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts/invoices"
                element={
                  <ProtectedRoute roles={['accounts_manager', 'accounts_incharge', 'it_admin', 'plant_head']}>
                    <SalesInvoicesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts/debit-credit-notes"
                element={
                  <ProtectedRoute roles={['accounts_manager', 'accounts_incharge', 'it_admin', 'plant_head']}>
                    <DebitCreditNotesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts/payments"
                element={
                  <ProtectedRoute roles={['accounts_manager', 'accounts_incharge', 'it_admin', 'plant_head']}>
                    <PaymentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts/copq"
                element={
                  <ProtectedRoute roles={['accounts_manager', 'accounts_incharge', 'it_admin', 'plant_head']}>
                    <COPQPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Mold Management Module ───────────────────────────────────────── */}
              <Route path="/mold/master"       element={<ProtectedRoute permission="mold-master-read"><MoldMasterPage /></ProtectedRoute>} />
              <Route path="/mold/master/:id"   element={<ProtectedRoute permission="mold-master-read"><MoldDetailPage /></ProtectedRoute>} />
              <Route path="/mold/cavities"     element={<ProtectedRoute permission="mold-cavities-read"><CavityTrackingPage /></ProtectedRoute>} />
              <Route path="/mold/shot-count"   element={<ProtectedRoute permission="mold-shot_count-read"><ShotCountPage /></ProtectedRoute>} />
              <Route path="/mold/life"         element={<ProtectedRoute permission="mold-life_management-read"><LifeManagementPage /></ProtectedRoute>} />
              <Route path="/mold/issue-return" element={<ProtectedRoute permission="mold-issue_return-read"><IssueReturnPage /></ProtectedRoute>} />
              <Route path="/mold/store"        element={<ProtectedRoute permission="mold-store_dashboard-read"><StoreDashboardPage /></ProtectedRoute>} />
              {/* Mold Management — Sprint 5 */}
              <Route path="/mold/pm"           element={<ProtectedRoute permission="mold-pm-read"><PMSchedulePage /></ProtectedRoute>} />
              <Route path="/mold/repair"       element={<ProtectedRoute permission="mold-repair-read"><RepairPage /></ProtectedRoute>} />
              <Route path="/mold/trial"        element={<ProtectedRoute permission="mold-trial-read"><TrialsPage /></ProtectedRoute>} />
              <Route path="/mold/cost"         element={<ProtectedRoute permission="mold-cost-read"><CostTrackingPage /></ProtectedRoute>} />
              <Route path="/mold/documents"    element={<ProtectedRoute permission="mold-documents-read"><MoldDocumentsPage /></ProtectedRoute>} />
              {/* Mold Management — Sprint 6 (AI) */}
              <Route path="/mold/ai-insights" element={<ProtectedRoute permission="mold-ai_insights-read"><AiInsightsPage /></ProtectedRoute>} />
              <Route path="/mold/selection"   element={<ProtectedRoute permission="mold-selection-read"><MoldSelectionPage /></ProtectedRoute>} />

              {/* Maintenance */}
              <Route path="/maintenance/equipment"    element={<ProtectedRoute permission="mnt-equipment-read"><EquipmentPage /></ProtectedRoute>} />
              <Route path="/maintenance/health"       element={<ProtectedRoute permission="mnt-health-read"><HealthDashboardPage /></ProtectedRoute>} />
              <Route path="/maintenance/breakdown"    element={<ProtectedRoute permission="mnt-breakdown-read"><BreakdownPage /></ProtectedRoute>} />
              <Route path="/maintenance/downtime"     element={<ProtectedRoute permission="mnt-downtime-read"><MntDowntimePage /></ProtectedRoute>} />
              <Route path="/maintenance/pm"           element={<ProtectedRoute permission="mnt-pm-read"><MntPMSchedulePage /></ProtectedRoute>} />
              <Route path="/maintenance/spare-parts"  element={<ProtectedRoute permission="mnt-spare_parts-read"><MntSparePartsPage /></ProtectedRoute>} />
              <Route path="/maintenance/loto"         element={<ProtectedRoute permission="mnt-loto-read"><MntLOTOPage /></ProtectedRoute>} />
              <Route path="/maintenance/kpi"          element={<ProtectedRoute permission="mnt-kpi-read"><MntKpiDashboardPage /></ProtectedRoute>} />

              {/* Madad full-page chat */}
              <Route path="/madad" element={<ProtectedRoute><MadadPage /></ProtectedRoute>} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
