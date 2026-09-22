import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/password'

const db = new PrismaClient()

// The school's flat class structure (NO class arms).
// KG → Nursery 1–2 → Primary 1–6 → JSS 1–3 → SS 1–3
const CLASS_DEFS: { name: string; level: number; category: string }[] = [
  { name: 'KG', level: 0, category: 'Early Years' },
  { name: 'Nursery 1', level: 1, category: 'Nursery' },
  { name: 'Nursery 2', level: 2, category: 'Nursery' },
  { name: 'Primary 1', level: 3, category: 'Primary' },
  { name: 'Primary 2', level: 4, category: 'Primary' },
  { name: 'Primary 3', level: 5, category: 'Primary' },
  { name: 'Primary 4', level: 6, category: 'Primary' },
  { name: 'Primary 5', level: 7, category: 'Primary' },
  { name: 'Primary 6', level: 8, category: 'Primary' },
  { name: 'JSS 1', level: 9, category: 'Junior Secondary' },
  { name: 'JSS 2', level: 10, category: 'Junior Secondary' },
  { name: 'JSS 3', level: 11, category: 'Junior Secondary' },
  { name: 'SS 1', level: 12, category: 'Senior Secondary' },
  { name: 'SS 2', level: 13, category: 'Senior Secondary' },
  { name: 'SS 3', level: 14, category: 'Senior Secondary' },
]

async function main() {
  // ── School settings (singleton) ────────────────────────────────────────
  await db.schoolSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      schoolName: "Redeemer's Schools and College",
      address: 'Owotoro, Oyo State, Nigeria',
      motto: 'Excellence, Knowledge, and Wisdom',
      principalName: 'The Principal',
    },
  })

  // ── Principal user ──────────────────────────────────────────────────────
  const principalEmail = 'principal@resco.edu.ng'
  const principalPass = process.env.PRINCIPAL_PASSWORD || 'Principal@2026'
  const existingPrincipal = await db.user.findUnique({ where: { email: principalEmail } })
  if (!existingPrincipal) {
    await db.user.create({
      data: {
        email: principalEmail,
        name: 'The Principal',
        role: 'PRINCIPAL',
        passwordHash: hashPassword(principalPass),
        active: true,
      },
    })
    console.log(`Principal created: ${principalEmail} / ${principalPass}`)
  } else {
    console.log('Principal already exists')
  }

  // ── Demo teacher (assigned to JSS 1 — Mathematics) ─────────────────────
  const teacherEmail = 'teacher@resco.edu.ng'
  const teacherPass = 'Teacher@2026'
  let teacherUser = await db.user.findUnique({
    where: { email: teacherEmail },
    include: { teacher: true },
  })
  if (!teacherUser) {
    teacherUser = await db.user.create({
      data: {
        email: teacherEmail,
        name: 'Mr. Ade Demo',
        role: 'TEACHER',
        passwordHash: hashPassword(teacherPass),
        active: true,
        teacher: { create: {} },
      },
      include: { teacher: true },
    })
    console.log(`Demo teacher created: ${teacherEmail} / ${teacherPass}`)
  } else {
    console.log('Demo teacher already exists')
  }

  // ── Classes (flat — no arms) ────────────────────────────────────────────
  for (const cd of CLASS_DEFS) {
    const existing = await db.class.findUnique({ where: { name: cd.name } })
    if (!existing) {
      await db.class.create({ data: { name: cd.name, level: cd.level, category: cd.category } })
    }
  }
  console.log(`Seeded ${CLASS_DEFS.length} classes (no arms)`)

  // ── Subjects ───────────────────────────────────────────────────────────
  const subjects = [
    'Mathematics',
    'English Language',
    'Basic Science',
    'Social Studies',
    'Civic Education',
    'Computer Studies',
    'Business Studies',
    'Agricultural Science',
    'Biology',
    'Chemistry',
    'Physics',
    'Government',
    'Economics',
    'Literature in English',
    'Geography',
    'Christian Religious Studies',
    'Further Mathematics',
  ]
  for (const name of subjects) {
    const exists = await db.subject.findFirst({ where: { name } })
    if (!exists) await db.subject.create({ data: { name } })
  }
  console.log('Subjects seeded')

  // ── Grade boundaries (default) ─────────────────────────────────────────
  const existingGrades = await db.gradeBoundary.count()
  if (existingGrades === 0) {
    const defaults = [
      { min: 80, max: 100, grade: 'A', order: 0 },
      { min: 70, max: 79, grade: 'B', order: 1 },
      { min: 60, max: 69, grade: 'C', order: 2 },
      { min: 50, max: 59, grade: 'D', order: 3 },
      { min: 40, max: 49, grade: 'E', order: 4 },
      { min: 0, max: 39, grade: 'F', order: 5 },
    ]
    for (const d of defaults) await db.gradeBoundary.create({ data: d })
    console.log('Grade boundaries seeded')
  }

  // ── Remarks ────────────────────────────────────────────────────────────
  const existingRemarks = await db.remark.count()
  if (existingRemarks === 0) {
    const remarks: { category: string; text: string }[] = [
      { category: 'Excellent Performance', text: 'Excellent performance. Keep it up.' },
      { category: 'Excellent Performance', text: 'An outstanding performance. Well done.' },
      { category: 'Excellent Performance', text: 'Has demonstrated excellent understanding of the subjects.' },
      { category: 'Excellent Performance', text: 'A highly dedicated and hardworking student.' },
      { category: 'Very Good Performance', text: 'Very good performance. Keep up the good work.' },
      { category: 'Very Good Performance', text: 'Has performed well this term.' },
      { category: 'Very Good Performance', text: 'Shows good understanding and commitment to learning.' },
      { category: 'Average Performance', text: 'A fair performance. More effort is required.' },
      { category: 'Average Performance', text: 'Has the potential to do better.' },
      { category: 'Average Performance', text: 'Needs to put more effort into academic work.' },
      { category: 'Needs Improvement', text: 'More effort is required to improve academic performance.' },
      { category: 'Needs Improvement', text: 'Needs to pay more attention to studies.' },
      { category: 'Needs Improvement', text: 'Should work harder and participate more actively in class.' },
      { category: 'Conduct', text: 'Demonstrates good conduct and discipline.' },
      { category: 'Conduct', text: 'Relates well with teachers and classmates.' },
      { category: 'Conduct', text: 'Should improve punctuality and regularity.' },
      { category: 'Conduct', text: 'Needs to demonstrate better discipline and concentration.' },
    ]
    for (const r of remarks) await db.remark.create({ data: r })
    console.log('Remarks seeded')
  }

  // ── Academic session + terms ───────────────────────────────────────────
  const sessionName = '2026/2027'
  let session = await db.academicSession.findUnique({ where: { name: sessionName } })
  if (!session) {
    session = await db.academicSession.create({ data: { name: sessionName, isActive: true } })
    const termDefs = [
      { name: 'First Term', order: 1, isActive: true },
      { name: 'Second Term', order: 2, isActive: false },
      { name: 'Third Term', order: 3, isActive: false },
    ]
    for (const td of termDefs) {
      await db.term.create({ data: { sessionId: session.id, name: td.name, order: td.order, isActive: td.isActive } })
    }
    console.log('Session & terms seeded')
  }
  const firstTerm = await db.term.findFirst({ where: { sessionId: session.id, order: 1 } })
  await db.schoolSetting.update({
    where: { id: 'singleton' },
    data: { currentSessionId: session.id, currentTermId: firstTerm?.id ?? null },
  })

  // ── Demo student: John Doe in JSS 1 (for the mandatory calculation test) ──
  const jss1 = await db.class.findUnique({ where: { name: 'JSS 1' } })
  if (jss1) {
    let john = await db.student.findUnique({ where: { admissionNumber: 'RES/2026/001' } })
    if (!john) {
      john = await db.student.create({
        data: {
          admissionNumber: 'RES/2026/001',
          firstName: 'John',
          lastName: 'Doe',
          gender: 'MALE',
          classId: jss1.id,
          active: true,
        },
      })
      console.log('Demo student John Doe created in JSS 1')
    }

    // Assign Mr. Ade Demo to JSS 1 — Mathematics
    const maths = await db.subject.findFirst({ where: { name: 'Mathematics' } })
    if (teacherUser.teacher && maths) {
      const existingAssignment = await db.teacherAssignment.findFirst({
        where: { teacherId: teacherUser.teacher.id, classId: jss1.id, subjectId: maths.id },
      })
      if (!existingAssignment) {
        await db.teacherAssignment.create({
          data: {
            teacherId: teacherUser.teacher.id,
            classId: jss1.id,
            subjectId: maths.id,
          },
        })
        console.log('Assigned Mr. Ade Demo → JSS 1 — Mathematics')
      }
    }
  }

  console.log('Seed complete.')
  console.log('Principal login:', principalEmail, '/', principalPass)
  console.log('Teacher login:', teacherEmail, '/', teacherPass, '(JSS 1 — Mathematics)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
