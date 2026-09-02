import type { Entity } from './common.ts';

export interface User extends Entity {
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Authentication state as far as the UI is concerned. */
export type AuthState =
  { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; user: User };
