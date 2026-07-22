/**
 * Wipe all operational data; keep ADMIN users (and SchoolSettings row).
 * Used by CLI script and ADMIN API.
 */
export async function resetDataKeepAdmin(prisma) {
  const summary = {};

  await prisma.$transaction(async (tx) => {
    summary.notifications = (await tx.notification.deleteMany()).count;
    summary.attendance = (await tx.attendance.deleteMany()).count;
    summary.lateReports = (await tx.lateReport.deleteMany()).count;
    summary.homework = (await tx.homework.deleteMany()).count;
    summary.weeklyPlans = (await tx.weeklyPlan.deleteMany()).count;
    summary.classEnrollments = (await tx.classEnrollment.deleteMany()).count;
    summary.teacherAssignments = (await tx.teacherAssignment.deleteMany()).count;
    summary.students = (await tx.student.deleteMany()).count;
    summary.importBatches = (await tx.studentImportBatch.deleteMany()).count;
    summary.classes = (await tx.class.deleteMany()).count;
    summary.subjects = (await tx.subject.deleteMany()).count;
    summary.parentOtps = (await tx.parentOtp.deleteMany()).count;
    summary.parentAccounts = (await tx.parentAccount.deleteMany()).count;
    summary.nonAdminUsers = (
      await tx.user.deleteMany({ where: { role: { not: 'ADMIN' } } })
    ).count;

    const admins = await tx.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, name: true },
    });
    summary.adminsKept = admins;

    if (admins.length === 0) {
      throw new Error('No ADMIN user left after reset — aborting');
    }

    // Ensure school settings singleton exists; do not wipe name/year if already set.
    const settings = await tx.schoolSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      await tx.schoolSettings.create({
        data: {
          id: 1,
          name: 'المدرسة',
          academicYear: '2026-2027',
          principalName: null,
          address: null,
          logoPath: null,
        },
      });
      summary.schoolSettings = 'created';
    } else {
      summary.schoolSettings = 'kept';
    }
  });

  return summary;
}
