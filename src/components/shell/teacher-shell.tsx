'use client'
import { ShellLayout, type NavItem } from '@/components/shell/shell-layout'
import { useAppStore } from '@/store/app-store'
import { LayoutDashboard, FileSpreadsheet, GraduationCap, FileText } from 'lucide-react'
import { TeacherDashboard } from '@/components/views/teacher/dashboard'
import { TeacherResultsEntry } from '@/components/views/teacher/results-entry'
import { TeacherMyStudents } from '@/components/views/teacher/my-students'
import { TeacherReportCards } from '@/components/views/teacher/report-cards'

export const TEACHER_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'results-entry', label: 'Enter Results', icon: FileSpreadsheet },
  { key: 'my-students', label: 'My Students', icon: GraduationCap },
  { key: 'report-cards', label: 'Report Cards', icon: FileText },
]

export function TeacherShell() {
  const view = useAppStore((s) => s.view)
  const user = useAppStore((s) => s.user)

  const views: Record<string, React.ReactNode> = {
    dashboard: <TeacherDashboard />,
    'results-entry': <TeacherResultsEntry />,
    'my-students': <TeacherMyStudents />,
    'report-cards': <TeacherReportCards />,
  }

  return (
    <ShellLayout
      navItems={TEACHER_NAV}
      title={`Hi, ${user?.name?.split(' ')[0] ?? 'Teacher'}`}
      subtitle="Teacher Portal"
    >
      {views[view] ?? views.dashboard}
    </ShellLayout>
  )
}
