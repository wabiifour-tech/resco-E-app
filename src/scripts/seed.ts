import { prismaClient } from '../lib/prisma-client'
import { hashPassword } from '../lib/password'

const db = prismaClient

// Set SEED_DEMO=1 to also create demo teachers + test student (Mr. Ade,
// Mrs. Adebayo, John Doe). Defaults to OFF for production deploys so the
// prod DB only gets the principal account + the curriculum library.
const SEED_DEMO = process.env.SEED_DEMO === '1'

// The school's flat class structure (NO class arms).
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

// ─── SUBJECT LIBRARY ──────────────────────────────────────────────────────
// Broad, configurable library covering early years, primary, junior & senior
// secondary. Based on NERDC baseline + school-specific requests (RNV, Islam,
// CRK, Yoruba, Civic Education, Business Studies, Social Studies, Animal
// Husbandry, Music, Poetry). Subjects are NOT auto-assigned to classes — the
// principal configures ClassSubject per class.
const SUBJECT_LIBRARY: { name: string; code?: string }[] = [
  // Core / cross-level
  { name: 'English Studies' },
  { name: 'Mathematics' },
  { name: 'Further Mathematics' },
  { name: 'Basic Science' },
  { name: 'Basic Science and Technology' },
  { name: 'Basic Technology' },
  { name: 'Physical and Health Education' },
  { name: 'Nigerian Language' },
  { name: 'Yoruba' },
  { name: 'Nigerian History' },
  { name: 'Social Studies' },
  { name: 'Social and Citizenship Studies' },
  { name: 'Civic Education' },
  { name: 'Cultural and Creative Arts (CCA)' },
  { name: 'Music' },
  { name: 'Poetry' },
  { name: 'Religious and National Values (RNV)' },
  { name: 'Christian Religious Studies (CRS)' },
  { name: 'Islamic Studies' },
  { name: 'Arabic Language' },
  { name: 'French' },
  { name: 'Basic Digital Literacy' },
  { name: 'Computer Studies' },
  { name: 'Pre-vocational Studies' },
  { name: 'Agricultural Science' },
  { name: 'Animal Husbandry' },
  { name: 'Home Economics' },
  { name: 'Business Studies' },
  { name: 'Economics' },
  { name: 'Government' },
  { name: 'Literature in English' },
  { name: 'Biology' },
  { name: 'Chemistry' },
  { name: 'Physics' },
  { name: 'Geography' },
  // Early-years learning areas
  { name: 'Letter Work' },
  { name: 'Number Work' },
  { name: 'Social Habits' },
  { name: 'Health Habits' },
  { name: 'Rhymes and Songs' },
  { name: 'Creative Arts' },
  { name: 'Handwriting' },
]

// ─── CLASS → SUBJECTS OFFERED (curriculum defaults) ──────────────────────
// Sensible curriculum-appropriate defaults per class. NOT every subject to
// every class. The principal can edit via the Subject Management UI.
const EARLY_YEARS_SUBJECTS = [
  'Letter Work',
  'Number Work',
  'Social Habits',
  'Health Habits',
  'Basic Science',
  'Rhymes and Songs',
  'Creative Arts',
  'Physical and Health Education',
  'Religious and National Values (RNV)',
  'Handwriting',
]

const PRIMARY_LOWER_SUBJECTS = [ // Primary 1–3
  'English Studies',
  'Mathematics',
  'Yoruba',
  'Basic Science',
  'Physical and Health Education',
  'Religious and National Values (RNV)',
  'Christian Religious Studies (CRS)',
  'Islamic Studies',
  'Nigerian History',
  'Social Studies',
  'Civic Education',
  'Cultural and Creative Arts (CCA)',
  'Music',
  'Poetry',
  'Handwriting',
]

const PRIMARY_UPPER_SUBJECTS = [ // Primary 4–6 (adds a few)
  'English Studies',
  'Mathematics',
  'Yoruba',
  'Basic Science and Technology',
  'Physical and Health Education',
  'Religious and National Values (RNV)',
  'Christian Religious Studies (CRS)',
  'Islamic Studies',
  'Nigerian History',
  'Social Studies',
  'Civic Education',
  'Cultural and Creative Arts (CCA)',
  'Music',
  'Poetry',
  'Basic Digital Literacy',
  'Computer Studies',
  'Pre-vocational Studies',
  'Agricultural Science',
  'Home Economics',
  'French',
  'Arabic Language',
  'Handwriting',
]

const JSS_SUBJECTS = [
  'English Studies',
  'Mathematics',
  'Basic Science',
  'Basic Technology',
  'Social Studies',
  'Civic Education',
  'Religious and National Values (RNV)',
  'Christian Religious Studies (CRS)',
  'Islamic Studies',
  'Arabic Language',
  'Yoruba',
  'French',
  'Cultural and Creative Arts (CCA)',
  'Music',
  'Computer Studies',
  'Business Studies',
  'Agricultural Science',
  'Home Economics',
  'Physical and Health Education',
  'Pre-vocational Studies',
]

const SS_SUBJECTS = [
  'English Studies',
  'Mathematics',
  'Further Mathematics',
  'Biology',
  'Chemistry',
  'Physics',
  'Agricultural Science',
  'Animal Husbandry',
  'Computer Studies',
  'Economics',
  'Government',
  'Literature in English',
  'Christian Religious Studies (CRS)',
  'Islamic Studies',
  'Arabic Language',
  'French',
  'Yoruba',
  'Civic Education',
  'Geography',
  'Home Economics',
  'Music',
  'Cultural and Creative Arts (CCA)',
  'Physical and Health Education',
  'Business Studies',
  'Religious and National Values (RNV)',
]

// Map class name → offered subjects. Includes the test-scenario subjects.
function classOfferedSubjects(className: string): string[] {
  if (className === 'KG') return EARLY_YEARS_SUBJECTS
  if (className.startsWith('Nursery')) return EARLY_YEARS_SUBJECTS
  if (['Primary 1', 'Primary 2', 'Primary 3'].includes(className)) return PRIMARY_LOWER_SUBJECTS
  if (['Primary 4', 'Primary 5', 'Primary 6'].includes(className)) return PRIMARY_UPPER_SUBJECTS
  if (className.startsWith('JSS')) return JSS_SUBJECTS
  if (className.startsWith('SS')) return SS_SUBJECTS
  return []
}

async function main() {
  // ── Guard: never re-seed an already-populated DB ───────────────────────
  // Protects the principal's runtime edits to subjects/classes/curriculum
  // from being overwritten on subsequent deploys.
  const existingUsers = await db.user.count()
  if (existingUsers > 0) {
    console.log(`DB already has ${existingUsers} user(s) — skipping seed.`)
    return
  }

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

  // ── Demo teachers (only when SEED_DEMO=1) ─────────────────────────────
  // Mr. Ade → JSS 1 — Mathematics; Mrs. Adebayo → multi-class test scenario.
  // Excluded from production deploys by default.
  let teacher1User: { id: string; teacher: { id: string } | null } | null = null
  let teacher2User: { id: string; teacher: { id: string } | null } | null = null
  if (SEED_DEMO) {
    const teacher1Email = 'teacher@resco.edu.ng'
    const teacher1Pass = 'Teacher@2026'
    teacher1User = await db.user.findUnique({
      where: { email: teacher1Email },
      include: { teacher: true },
    })
    if (!teacher1User) {
      teacher1User = await db.user.create({
        data: {
          email: teacher1Email,
          name: 'Mr. Ade Demo',
          role: 'TEACHER',
          passwordHash: hashPassword(teacher1Pass),
          active: true,
          teacher: { create: {} },
        },
        include: { teacher: true },
      })
      console.log(`Demo teacher 1 created: ${teacher1Email} / ${teacher1Pass}`)
    }

    const teacher2Email = 'adebayo@resco.edu.ng'
    const teacher2Pass = 'Adebayo@2026'
    teacher2User = await db.user.findUnique({
      where: { email: teacher2Email },
      include: { teacher: true },
    })
    if (!teacher2User) {
      teacher2User = await db.user.create({
        data: {
          email: teacher2Email,
          name: 'Mrs. Adebayo',
          role: 'TEACHER',
          passwordHash: hashPassword(teacher2Pass),
          active: true,
          teacher: { create: {} },
        },
        include: { teacher: true },
      })
      console.log(`Demo teacher 2 created: ${teacher2Email} / ${teacher2Pass}`)
    }
  }

  // ── Classes (flat — no arms) ────────────────────────────────────────────
  for (const cd of CLASS_DEFS) {
    const existing = await db.class.findUnique({ where: { name: cd.name } })
    if (!existing) {
      await db.class.create({ data: { name: cd.name, level: cd.level, category: cd.category } })
    }
  }
  console.log(`Seeded ${CLASS_DEFS.length} classes (no arms)`)

  // ── Subject library ─────────────────────────────────────────────────────
  const subjectMap = new Map<string, string>() // name → id
  for (const s of SUBJECT_LIBRARY) {
    const exists = await db.subject.findFirst({ where: { name: s.name } })
    if (exists) {
      subjectMap.set(s.name, exists.id)
    } else {
      const created = await db.subject.create({ data: { name: s.name, code: s.code ?? null } })
      subjectMap.set(s.name, created.id)
    }
  }
  console.log(`Seeded ${subjectMap.size} subjects in the library`)

  // ── ClassSubject defaults (which subjects each class offers) ───────────
  for (const cd of CLASS_DEFS) {
    const klass = await db.class.findUnique({ where: { name: cd.name } })
    if (!klass) continue
    const offered = classOfferedSubjects(cd.name)
    for (const subjName of offered) {
      const subjId = subjectMap.get(subjName)
      if (!subjId) continue
      const exists = await db.classSubject.findUnique({
        where: {
          classId_subjectId: { classId: klass.id, subjectId: subjId },
        },
      })
      if (!exists) {
        await db.classSubject.create({ data: { classId: klass.id, subjectId: subjId } })
      }
    }
  }
  console.log('Seeded ClassSubject defaults per class')

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

  // ── Demo student: John Doe in JSS 1 (SEED_DEMO only) ───────────────────
  const jss1 = await db.class.findUnique({ where: { name: 'JSS 1' } })
  if (SEED_DEMO && jss1) {
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
  }

  // ── Assignment 1: Mr. Ade → JSS 1 — Mathematics ────────────────────────
  if (teacher1User?.teacher && jss1) {
    const maths = await db.subject.findFirst({ where: { name: 'Mathematics' } })
    if (maths) {
      const exists = await db.teacherAssignment.findFirst({
        where: { teacherId: teacher1User.teacher.id, classId: jss1.id, subjectId: maths.id },
      })
      if (!exists) {
        await db.teacherAssignment.create({
          data: { teacherId: teacher1User.teacher.id, classId: jss1.id, subjectId: maths.id },
        })
        console.log('Assigned Mr. Ade Demo → JSS 1 — Mathematics')
      }
    }
  }

  // ── Assignment 2 (TEST SCENARIO): Mrs. Adebayo multi-class multi-subject
  //    Primary 2: Class Teacher = YES, English Studies, Mathematics, Basic Science
  //    Primary 3: Class Teacher = NO,  English Studies, Yoruba
  //    Primary 5: Class Teacher = YES, Social Studies, Civic Education
  if (teacher2User?.teacher) {
    const scenarios: { className: string; classTeacher: boolean; subjects: string[] }[] = [
      { className: 'Primary 2', classTeacher: true, subjects: ['English Studies', 'Mathematics', 'Basic Science'] },
      { className: 'Primary 3', classTeacher: false, subjects: ['English Studies', 'Yoruba'] },
      { className: 'Primary 5', classTeacher: true, subjects: ['Social Studies', 'Civic Education'] },
    ]
    for (const sc of scenarios) {
      const klass = await db.class.findUnique({ where: { name: sc.className } })
      if (!klass) continue
      // Class-teacher responsibility
      if (sc.classTeacher) {
        const ctExists = await db.classTeacher.findUnique({
          where: { teacherId_classId: { teacherId: teacher2User.teacher.id, classId: klass.id } },
        })
        if (!ctExists) {
          await db.classTeacher.create({
            data: { teacherId: teacher2User.teacher.id, classId: klass.id },
          })
        }
      }
      // Subject-teaching assignments
      for (const subjName of sc.subjects) {
        const subj = await db.subject.findFirst({ where: { name: subjName } })
        if (!subj) continue
        const exists = await db.teacherAssignment.findFirst({
          where: { teacherId: teacher2User.teacher.id, classId: klass.id, subjectId: subj.id },
        })
        if (!exists) {
          await db.teacherAssignment.create({
            data: { teacherId: teacher2User.teacher.id, classId: klass.id, subjectId: subj.id },
          })
        }
      }
    }
    console.log('Assigned Mrs. Adebayo → Primary 2 (CT + English/Maths/Basic Science), Primary 3 (English/Yoruba), Primary 5 (CT + Social Studies/Civic Education)')
  }

  console.log('Seed complete.')
  console.log('Principal login:', principalEmail, '/', principalPass)
  if (SEED_DEMO) {
    console.log('Demo teacher 1: teacher@resco.edu.ng / Teacher@2026 (JSS 1 — Mathematics)')
    console.log('Demo teacher 2: adebayo@resco.edu.ng / Adebayo@2026 (Primary 2/3/5 — multi-class multi-subject)')
  } else {
    console.log('(Demo teachers not created — set SEED_DEMO=1 to include them.)')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
