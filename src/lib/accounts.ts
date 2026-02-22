export type AccountRole = 'triage' | 'doctor' | 'receptionist';

export interface Account {
  id: string;
  name: string;
  role: AccountRole;
  roleLabel: string;
  initials: string;
  agentIds?: string[];
  doctorName?: string;
}

export const mockAccounts: Account[] = [
  // Triage operators
  { 
    id: 'w1', 
    name: 'Arhaan K.', 
    role: 'triage', 
    roleLabel: 'Lead Triage Nurse', 
    initials: 'AK', 
    agentIds: ['a1', 'a2', 'a3'] 
  },
  { 
    id: 'w2', 
    name: 'James P.', 
    role: 'triage', 
    roleLabel: 'Senior Operator', 
    initials: 'JP', 
    agentIds: ['a4', 'a5'] 
  },
  { 
    id: 'w3', 
    name: 'Sara M.', 
    role: 'triage', 
    roleLabel: 'Night Shift Lead', 
    initials: 'SM', 
    agentIds: ['a6', 'a7', 'a8'] 
  },
  
  // Doctors
  { 
    id: 'doc1', 
    name: 'Dr. Sarah Chen', 
    role: 'doctor', 
    roleLabel: 'Cardiologist', 
    initials: 'SC',
    doctorName: 'Dr. Sarah Chen',
  },
  { 
    id: 'doc2', 
    name: 'Dr. James Park', 
    role: 'doctor', 
    roleLabel: 'Internal Medicine', 
    initials: 'JP',
    doctorName: 'Dr. James Park',
  },
  { 
    id: 'doc3', 
    name: 'Dr. Michael Torres', 
    role: 'doctor', 
    roleLabel: 'Family Medicine', 
    initials: 'MT',
    doctorName: 'Dr. Michael Torres',
  },
  
  // Receptionist (placeholder for future)
  { 
    id: 'rec1', 
    name: 'Emily Davis', 
    role: 'receptionist', 
    roleLabel: 'Front Desk', 
    initials: 'ED' 
  },
];

export function getAccountById(id: string): Account | undefined {
  return mockAccounts.find((a) => a.id === id);
}
