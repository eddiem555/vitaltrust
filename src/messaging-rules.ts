import { User } from './types';

/** EHR messaging policy: patients may not message other patients. All other cross-role pairs are allowed. */
export function canSendMessage(senderRole: User['role'], receiverRole: User['role']): boolean {
  if (senderRole === 'patient' && receiverRole === 'patient') return false;
  return true;
}

export function filterAllowedRecipients(
  senderRole: User['role'],
  users: Pick<User, 'id' | 'role' | 'realName'>[]
): Pick<User, 'id' | 'role' | 'realName'>[] {
  return users.filter(
    (u) => u.role !== senderRole || senderRole !== 'patient' // always exclude self in UI separately
  ).filter((u) => canSendMessage(senderRole, u.role));
}
