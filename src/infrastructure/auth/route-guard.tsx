'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { authFSM, AuthState } from './auth-fsm';
import { Skeleton } from '@/design-system';

const subscribe = (callback: () => void) => authFSM.subscribe(() => callback());
const getSnapshot = () => authFSM.getState();
const getServerSnapshot = () => 'UNAUTHENTICATED' as AuthState;

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerClientSnapshot = () => false;

export const RouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const authState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isClient = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerClientSnapshot);

  useEffect(() => {
    if (isClient && (authState === 'UNAUTHENTICATED' || authState === 'EXPIRED')) {
      router.push('/login');
    }
  }, [authState, isClient, router]);

  if (!isClient || authState === 'AUTHENTICATING' || authState === 'REFRESHING') {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-8 gap-4">
        <Skeleton width="200px" height="24px" radius="12px" />
        <Skeleton width="340px" height="120px" radius="18px" />
      </div>
    );
  }

  if (authState === 'UNAUTHENTICATED' || authState === 'EXPIRED') {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
};
