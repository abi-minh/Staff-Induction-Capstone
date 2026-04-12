/// <reference types="vite/client" />

import type { AdminUser } from './types';

declare global {
  interface InductionAdminRuntime {
    nonce: string;
    restUrl: string;
    currentUser: AdminUser | null;
  }

  interface Window {
    InductionAdmin?: InductionAdminRuntime;
  }
}

export {};
