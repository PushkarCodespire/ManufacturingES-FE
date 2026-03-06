import React from 'react';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../components/AppLayout';
import RoleDashboard from './components/RoleDashboard';

const DashboardPage = () => {
  const { user } = useAuth();
  return (
    <AppLayout>
      <RoleDashboard user={user} />
    </AppLayout>
  );
};

export default DashboardPage;
