'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { mockAccounts, type Account } from '@/lib/accounts';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentAccount, setCurrentAccount] = useState<Account>(mockAccounts[0]);

  // Handle account switching
  function handleAccountSwitch(account: Account) {
    setCurrentAccount(account);
    
    // Route based on role
    if (account.role === 'doctor') {
      router.push('/doctor');
    } else if (account.role === 'triage') {
      router.push('/');
    } else if (account.role === 'receptionist') {
      // Future: router.push('/receptionist');
      router.push('/');
    }
  }

  // Sync account with current route on mount
  useEffect(() => {
    if (pathname.startsWith('/doctor')) {
      const doctorAccount = mockAccounts.find((a) => a.role === 'doctor');
      if (doctorAccount && currentAccount.role !== 'doctor') {
        setCurrentAccount(doctorAccount);
      }
    } else if (pathname === '/') {
      const triageAccount = mockAccounts.find((a) => a.role === 'triage');
      if (triageAccount && currentAccount.role !== 'triage') {
        setCurrentAccount(triageAccount);
      }
    }
  }, [pathname, currentAccount.role]);

  return (
    <>
      {children}
    </>
  );
}
