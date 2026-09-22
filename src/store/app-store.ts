'use client'
import { create } from 'zustand'

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

export const useAppStore = create<AppState>((set) => ({
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
    set({ user: null, view: 'dashboard' })
  },
}))
