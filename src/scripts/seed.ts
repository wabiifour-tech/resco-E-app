import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/password'

const db = new PrismaClient()

async function main() {
  // ── School settings (singleton) ────────────────────────────────────────
  const settings = await db.schoolSetting.upsert({
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

  // ── Demo teacher (for quick testing) ───────────────────────────────────
  const teacherEmail = 'teacher@resco.edu.ng'
  const teacherPass = 'Teacher@2026'
  const existingTeacher = await db.user.findUnique({ where: { email: teacherEmail } })
  if (!existingTeacher) {
    await db.user.create({
      data: {
        email: teacherEmail,
        name: 'Mr. Ade Demo',
        role: 'TEACHER',
        passwordHash: hashPassword(teacherPass),
        active: true,
        teacher: { create: {} },
      },
    })
    console.log(`Demo teacher created: ${teacherEmail} / ${teacherPass}`)
  } else {
    console.log('Demo teacher already exists')
  }

  // ── Classes + arms ──────────────────────────────────────────────────────
  const classDefs = [
    { name: 'JSS1', level: 1, arms: ['A', 'B'] },
    { name: 'JSS2', level: 2, arms: ['A', 'B'] },
    { name: 'JSS3', level: 3, arms: ['A', 'B'] },
    { name: 'SS1', level: 4, arms: ['A', 'B'] },
    { name: 'SS2', level: 5, arms: ['A', 'B'] },
    { name: 'SS3', level: 6, arms: ['A', 'B'] },
  ]
  for (const cd of classDefs) {
    const cls = await db.class.findFirst({ where: { name: cd.name } })
    let classId: string
    if (cls) {
      classId = cls.id
    } else {
      const created = await db.class.create({ data: { name: cd.name, level: cd.level } })
      classId = created.id
    }
    for (const armName of cd.arms) {
      const fullName = `${cd.name}${armName}`
      const exists = await db.classArm.findFirst({ where: { fullName } })
      if (!exists) {
        await db.classArm.create({ data: { classId, name: armName, fullName } })
      }
    }
  }
  console.log('Classes & arms seeded')

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

  // ── Remarks ─────────────────────────────────────────────────────────────
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
  // Set active session/term in settings
  const firstTerm = await db.term.findFirst({ where: { sessionId: session.id, order: 1 } })
  await db.schoolSetting.update({
    where: { id: 'singleton' },
    data: { currentSessionId: session.id, currentTermId: firstTerm?.id ?? null },
  })

  console.log('Seed complete.')
  console.log('Principal login:', principalEmail, '/', principalPass)
  console.log('Teacher login:', teacherEmail, '/', teacherPass)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
