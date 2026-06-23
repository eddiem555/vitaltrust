import React from 'react';
import InfraTopology from './InfraTopology';
import AuditLogs from './AuditLogs';
import UserManagement from '../admin/UserManagement';
import AISettings from './AISettings';
import VitalTrustAIChatbot from './VitalTrustAIChatbot';
import MessagesPanel from './MessagesPanel';
import { User } from '../../types';

interface AdminDashboardProps {
  tab: string;
  user: User;
}

export default function AdminDashboard({ tab, user }: AdminDashboardProps) {
  switch (tab) {
    case 'overview':
      return <InfraTopology user={user} />;
    case 'management':
      return <UserManagement />;
    case 'messages':
      return <MessagesPanel user={user} />;
    case 'ai_assistant':
      return <VitalTrustAIChatbot key={user.id} user={user} />;
    case 'logs':
      return <AuditLogs />;
    case 'settings':
      return <AISettings user={user} />;
    default:
      return <InfraTopology user={user} />;
  }
}
