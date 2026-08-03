/**
 * ClassEnrollment helpers — keep endDate and openMarker in sync.
 * openMarker = studentId while the enrollment is open (endDate null);
 * openMarker = null when closed. Enforced by @@unique on openMarker.
 */

export async function closeOpenEnrollments(tx, studentId, endDate = new Date()) {
  return tx.classEnrollment.updateMany({
    where: { studentId, endDate: null },
    data: { endDate, openMarker: null },
  });
}

export async function openEnrollment(
  tx,
  { studentId, classId, academicYear, changedBy = null, startDate = new Date() }
) {
  return tx.classEnrollment.create({
    data: {
      studentId,
      classId,
      academicYear,
      changedBy,
      startDate,
      endDate: null,
      openMarker: studentId,
    },
  });
}

/** One-time / startup backfill for rows created before openMarker existed. */
export async function backfillOpenMarkers(prisma) {
  const opens = await prisma.classEnrollment.findMany({
    where: { endDate: null, OR: [{ openMarker: null }, { openMarker: '' }] },
    select: { id: true, studentId: true },
  });
  let fixed = 0;
  let conflicts = 0;
  for (const row of opens) {
    try {
      await prisma.classEnrollment.update({
        where: { id: row.id },
        data: { openMarker: row.studentId },
      });
      fixed += 1;
    } catch {
      conflicts += 1;
    }
  }
  return { fixed, conflicts, scanned: opens.length };
}
