import React from 'react';
import { User } from '../types';

import DoctorDashboard from './dashboard/DoctorDashboard';
import NurseDashboard from './dashboard/NurseDashboard';
import PatientDashboard from './dashboard/PatientDashboard';
import AdminDashboard from './dashboard/AdminDashboard';
import Documentation from './dashboard/Documentation';

interface DashboardProps {
  tab: string;
  user: User;
}

export default function Dashboard({ tab, user }: DashboardProps) {
  // Common views across all roles
  if (tab === 'docs') {
    return <Documentation user={user} />;
  }

  // If user is admin, show the full security/lab dashboard
  if (user.role === 'admin') {
    return <AdminDashboard tab={tab} user={user} />;
  }

  // Otherwise, show clinical views based on role
  switch (user.role) {
    case 'doctor':
      return <DoctorDashboard tab={tab} user={user} />;
    case 'nurse':
      return <NurseDashboard tab={tab} user={user} />;
    case 'patient':
      return <PatientDashboard tab={tab} user={user} />;
    default:
      return <PatientDashboard tab={tab} user={user} />;
  }
}
