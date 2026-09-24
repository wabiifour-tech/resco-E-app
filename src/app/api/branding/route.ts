import { db } from '@/lib/db'

// Public school branding (no auth required): logo, name, motto, address.
// Used by the login screen + app shell to display the school logo instead of
// a generic placeholder. School name/logo/motto are public information.

export async function GET() {
  const settings = await db.schoolSetting.findUnique({ where: { id: 'singleton' } })
  return Response.json({
    schoolName: settings?.schoolName ?? "Redeemer's Schools and College",
    address: settings?.address ?? 'Owotoro, Oyo State, Nigeria',
    phone: settings?.phone ?? null,
    motto: settings?.motto ?? 'Excellence, Knowledge, and Wisdom',
    // Prefer the configured logoDataUrl; fall back to the static asset.
    logoUrl: settings?.logoDataUrl ?? '/school-logo.png',
    principalName: settings?.principalName ?? null,
  })
}
