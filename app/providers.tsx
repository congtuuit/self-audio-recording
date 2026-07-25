'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DialogProvider } from '../context/DialogContext';
import { I18nProvider } from '../context/I18nContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false, // Disable refetch on window focus
        staleTime: 5000,             // Consider data fresh for 5 seconds
        retry: false,                // Disable automatic retries in dev
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <DialogProvider>
          {children}
        </DialogProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
