'use client'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: 'PRINCIPAL' | 'TEACHER'
  teacherId: string | null
}

export type PrincipalView =
  | 'dashboard'
  | 'teachers'
  | 'students'
  | 'classes'
  | 'subjects'
  | 'sessions'
  | 'terms'
  | 'assignments'
  | 'remarks'
  | 'grading'
  | 'results'
  | 'approvals'
  | 'report-cards'
  | 'audit'
  | 'settings'

export type TeacherView =
  | 'dashboard'
  | 'results-entry'
  | 'my-students'
  | 'report-cards'

type AppState = {
  user: SessionUser | null
  loadingAuth: boolean
  view: string
  setUser: (u: SessionUser | null) => void
  setLoadingAuth: (b: boolean) => void
  setView: (v: string) => void
  logout: () => Promise<void>
}

// Persist ONLY the active `view` to localStorage so a browser reload restores
// the same page the user was on (instead of resetting to the dashboard).
// `user` is NOT persisted — it's restored via /api/auth/me (the session cookie).
// `loadingAuth` is not persisted (always starts true until /api/auth/me resolves).
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      loadingAuth: true,
      view: 'dashboard',
      setUser: (user) => set({ user }),
      setLoadingAuth: (loadingAuth) => set({ loadingAuth }),
      setView: (view) => set({ view }),
      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' })
        } catch {}
        // Reset the view on logout so the next user starts at the dashboard.
        set({ user: null, view: 'dashboard' })
      },
    }),
    {
      name: 'resco-ecard-view',
      storage: createJSONStorage(() => localStorage),
      // Persist only the view — never the session user (security) or loading flag.
      partialize: (state) => ({ view: state.view }) as Partial<AppState>,
      // Don't block hydration — the persisted view is read synchronously and
      // the initial render still shows the loading splash (loadingAuth=true)
      // until /api/auth/me resolves, so there's no hydration mismatch.
      skipHydration: false,
    },
  ),
)
