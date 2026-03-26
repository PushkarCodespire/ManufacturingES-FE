import React from 'react';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../components/AppLayout';
import RoleDashboard from './components/RoleDashboard';

const DashboardPage = () => {
  const { user, currentSiteId } = useAuth();
  return (
    <AppLayout>
      <RoleDashboard user={user} siteId={currentSiteId} />
    </AppLayout>
  );
};

export default DashboardPage;
