'use client'
import { ShellLayout, type NavItem } from '@/components/shell/shell-layout'
import { useAppStore } from '@/store/app-store'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  CalendarRange,
  ClipboardList,
  MessageSquareQuote,
  Award,
  FileSpreadsheet,
  CheckCircle2,
  FileText,
  History,
  Settings,
} from 'lucide-react'
import { PrincipalDashboard } from '@/components/views/principal/dashboard'
import { PrincipalTeachers } from '@/components/views/principal/teachers'
import { PrincipalStudents } from '@/components/views/principal/students'
import { PrincipalClasses } from '@/components/views/principal/classes'
import { PrincipalSubjects } from '@/components/views/principal/subjects'
import { PrincipalSessions } from '@/components/views/principal/sessions'
import { PrincipalTerms } from '@/components/views/principal/terms'
import { PrincipalAssignments } from '@/components/views/principal/assignments'
import { PrincipalRemarks } from '@/components/views/principal/remarks'
import { PrincipalGrading } from '@/components/views/principal/grading'
import { PrincipalResults } from '@/components/views/principal/results'
import { PrincipalApprovals } from '@/components/views/principal/approvals'
import { PrincipalReportCards } from '@/components/views/principal/report-cards'
import { PrincipalAudit } from '@/components/views/principal/audit'
import { PrincipalSettings } from '@/components/views/principal/settings'
import { TeacherResultsEntry } from '@/components/views/teacher/results-entry'
import { TeacherMyStudents } from '@/components/views/teacher/my-students'
import { TeacherReportCards } from '@/components/views/teacher/report-cards'

// The principal's shell. The principal is ALSO a teacher (with a 1:1 Teacher
// record) so she can teach subjects for classes she's assigned to. The
// "Teacher Tools" group below the principal items renders the teacher views
// — they consume /api/dashboard/teacher, /api/results/bootstrap, etc. which
// scope the principal to HER own assignments. Keys use a `t-` prefix to
// avoid colliding with the principal's `results`/`report-cards` keys.
export const PRINCIPAL_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'teachers', label: 'Teachers', icon: Users },
  { key: 'students', label: 'Students', icon: GraduationCap },
  { key: 'classes', label: 'Classes', icon: Layers },
  { key: 'subjects', label: 'Subjects', icon: BookOpen },
  { key: 'sessions', label: 'Academic Sessions', icon: CalendarRange },
  { key: 'terms', label: 'Terms', icon: ClipboardList },
  { key: 'assignments', label: 'Teacher Assignments', icon: ClipboardList },
  { key: 'remarks', label: 'Remarks', icon: MessageSquareQuote },
  { key: 'grading', label: 'Grading', icon: Award },
  { key: 'results', label: 'Results', icon: FileSpreadsheet },
  { key: 'approvals', label: 'Approvals', icon: CheckCircle2 },
  { key: 'report-cards', label: 'Report Cards', icon: FileText },
  { key: 'audit', label: 'Audit Logs', icon: History },
  { key: 'settings', label: 'School Settings', icon: Settings },
  // ── Teacher Tools (scoped to the principal's own assignments) ────────
  {
    key: 't-results-entry',
    label: 'Enter Results',
    icon: FileSpreadsheet,
    divider: true,
    heading: 'Teacher Tools',
  },
  { key: 't-my-students', label: 'My Students', icon: GraduationCap },
  { key: 't-report-cards', label: 'Report Cards', icon: FileText },
]

export function PrincipalShell() {
  const view = useAppStore((s) => s.view)
  const user = useAppStore((s) => s.user)

  const views: Record<string, React.ReactNode> = {
    dashboard: <PrincipalDashboard />,
    teachers: <PrincipalTeachers />,
    students: <PrincipalStudents />,
    classes: <PrincipalClasses />,
    subjects: <PrincipalSubjects />,
    sessions: <PrincipalSessions />,
    terms: <PrincipalTerms />,
    assignments: <PrincipalAssignments />,
    remarks: <PrincipalRemarks />,
    grading: <PrincipalGrading />,
    results: <PrincipalResults />,
    approvals: <PrincipalApprovals />,
    'report-cards': <PrincipalReportCards />,
    audit: <PrincipalAudit />,
    settings: <PrincipalSettings />,
    // Teacher Tools (scoped to the principal's own assignments via the
    // /api/dashboard/teacher + /api/results/* scoping changes).
    't-results-entry': <TeacherResultsEntry />,
    't-my-students': <TeacherMyStudents />,
    't-report-cards': <TeacherReportCards />,
  }

  return (
    <ShellLayout
      navItems={PRINCIPAL_NAV}
      title={`Hi, ${user?.name?.split(' ')[0] ?? 'Principal'}`}
      subtitle="Principal Portal"
    >
      {views[view] ?? views.dashboard}
    </ShellLayout>
  )
}
