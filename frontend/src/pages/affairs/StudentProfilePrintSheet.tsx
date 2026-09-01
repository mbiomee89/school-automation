import type { ReactNode } from 'react'
import type { StudentProfilePayload, StudentProfileSubmission } from '../../api/studentProfile'

const RELATION_AR: Record<string, string> = {
  FATHER: 'أب',
  MOTHER: 'أم',
  BROTHER: 'أخ',
  SISTER: 'أخت',
  UNCLE_P: 'عم',
  UNCLE_M: 'خال',
  GUARDIAN: 'وصي',
  OTHER: 'أخرى',
}

const ID_TYPE_AR: Record<string, string> = {
  NATIONAL: 'هوية وطنية',
  IQAMA: 'إقامة',
  VISIT: 'زيارة',
}

const HOUSING_AR: Record<string, string> = {
  OWNED: 'ملك',
  RENT: 'إيجار',
  OTHER: 'أخرى',
}

export type SchoolPrintHeader = {
  schoolName: string
  academicYear: string
  educationAdminName?: string | null
  logoUrl?: string | null
  principalName?: string | null
}

function Cell({
  label,
  value,
  className,
  dir,
  colSpan,
}: {
  label: string
  value?: ReactNode
  className?: string
  dir?: 'ltr' | 'rtl'
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border border-slate-700 px-1.5 py-0.5 align-top ${className ?? ''}`}
    >
      <div className="text-[9px] font-bold leading-tight text-slate-600">{label}</div>
      <div className="min-h-[1rem] text-[13px] leading-snug text-slate-900" dir={dir}>
        {value || '—'}
      </div>
    </td>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <tr>
      <th
        colSpan={4}
        className="border border-teal-800 bg-teal-700 px-2 py-1 text-start text-sm font-bold text-white"
      >
        {children}
      </th>
    </tr>
  )
}

function whatsappOf(p: StudentProfilePayload) {
  if (p.guardianWhatsapp?.trim()) return p.guardianWhatsapp.trim()
  return p.guardianMobile || '—'
}

function enName(p: StudentProfilePayload) {
  return [p.nameEnFirst, p.nameEnFather, p.nameEnGrand, p.nameEnFamily].filter(Boolean).join(' ')
}

function formatSubmittedAt(iso: string) {
  try {
    return new Date(iso).toLocaleString('ar-SA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

/** One printable page: homework-style school header + PDF-like personal-data form. */
export function StudentProfilePrintSheet({
  submission,
  header,
}: {
  submission: StudentProfileSubmission
  header: SchoolPrintHeader
}) {
  const p = submission.payload
  const adminLabel = header.educationAdminName?.trim() || 'الإدارة العامة للتعليم'
  const className = submission.className || p.className || '—'
  const studentId = submission.studentId || submission.enteredStudentId
  const blood = !p.bloodType || p.bloodType === 'UNKNOWN' ? 'لا أعرف' : p.bloodType
  const housing = p.housing ? HOUSING_AR[p.housing] || p.housing : '—'

  return (
    <section
      className="student-profile-print-sheet mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm print:mb-0 print:overflow-visible print:break-after-page print:rounded-none print:border-0 print:shadow-none"
      style={{ fontFamily: '"Noto Naskh Arabic", "Amiri", "Times New Roman", serif' }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="text-sm leading-relaxed text-slate-600">
          <p className="font-semibold text-slate-800">{adminLabel}</p>
          <p className="mt-1 font-semibold text-slate-800">مدرسة {header.schoolName}</p>
          {header.academicYear ? (
            <p className="mt-1 text-xs text-slate-500">العام الدراسي {header.academicYear}</p>
          ) : null}
        </div>
        <div className="flex justify-center self-center">
          {header.logoUrl ? (
            <img
              src={header.logoUrl}
              alt={header.schoolName}
              className="h-16 w-16 object-contain sm:h-20 sm:w-20"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] text-slate-400 sm:h-20 sm:w-20">
              الشعار
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <div className="min-w-[9rem] rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-xs font-semibold text-white shadow-sm sm:text-sm">
            <p className="leading-5">{className}</p>
            <p className="mt-1 leading-5" dir="ltr">
              {studentId}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#1e3a5f] px-4 py-2.5 text-center text-base font-bold text-white">
        استمارة البيانات الشخصية للطالب
      </div>

      <div className="p-3 sm:p-4">
        <table className="w-full table-fixed border-collapse text-start">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-1/4" />
            <col className="w-1/4" />
            <col className="w-1/4" />
          </colgroup>
          <tbody>
            <SectionTitle>البيانات الشخصية</SectionTitle>
            <tr>
              <Cell label="المرحلة الدراسية" value={p.stage || 'الابتدائية'} />
              <Cell label="الصف / الفصل" value={className} />
              <Cell label="الجنسية" value={p.nationality} />
              <Cell label="رقم السجل المدني / الإقامة" value={p.civilId} dir="ltr" />
            </tr>
            <tr>
              <Cell label="رقم الطالب (خاص بالمدرسة)" value={studentId} dir="ltr" />
              <Cell label="تاريخ الهوية" value={p.idIssueDate || '—'} dir="ltr" />
              <Cell label="رقم جواز السفر" value={p.passportNumber || '—'} dir="ltr" />
              <Cell label="تاريخ الميلاد" value={p.birthDate} dir="ltr" />
            </tr>
            <tr>
              <Cell label="الاسم رباعياً (عربي)" value={p.nameAr} colSpan={2} />
              <Cell label="English name" value={enName(p)} dir="ltr" colSpan={2} />
            </tr>
            <tr>
              <Cell label="مكان الولادة — الدولة" value={p.birthCountry} />
              <Cell label="مكان الميلاد / المدينة" value={p.birthCity} />
              <Cell label="فئة الدم" value={blood} />
              <Cell label="ملكية السكن" value={housing} />
            </tr>

            <SectionTitle>بيانات الاتصال</SectionTitle>
            <tr>
              <Cell label="المنطقة الإدارية" value={p.adminRegion} />
              <Cell label="المدينة" value={p.city} />
              <Cell label="الحي" value={p.district} />
              <Cell label="رقم المنزل" value={p.houseNumber} />
            </tr>
            <tr>
              <Cell label="الشارع الرئيسي" value={p.streetMain} colSpan={2} />
              <Cell label="الشارع الفرعي" value={p.streetSub || '—'} colSpan={2} />
            </tr>
            <tr>
              <Cell label="البريد الإلكتروني" value={p.email} dir="ltr" colSpan={2} />
              <Cell label="الرمز البريدي" value={p.postalCode || '—'} dir="ltr" />
              <Cell label="صندوق البريد" value={p.poBox || '—'} />
            </tr>

            <SectionTitle>بيانات ولي أمر الطالب</SectionTitle>
            <tr>
              <Cell label="اسم ولي الأمر" value={p.guardianName} />
              <Cell label="الجنسية" value={p.guardianNationality} />
              <Cell
                label="صلة القرابة"
                value={RELATION_AR[p.guardianRelation] || p.guardianRelation}
              />
              <Cell
                label="نوع الهوية"
                value={ID_TYPE_AR[p.guardianIdType] || p.guardianIdType}
              />
            </tr>
            <tr>
              <Cell label="رقم الهوية" value={p.guardianIdNumber} dir="ltr" />
              <Cell label="تاريخها" value={p.guardianIdIssueDate} dir="ltr" />
              <Cell label="مصدرها" value={p.guardianIdSource} />
              <Cell label="نهايتها" value={p.guardianIdExpiry} dir="ltr" />
            </tr>
            <tr>
              <Cell label="هاتف المنزل" value={p.guardianHomePhone || '—'} dir="ltr" />
              <Cell label="الجوال" value={p.guardianMobile} dir="ltr" />
              <Cell label="واتساب" value={whatsappOf(p)} dir="ltr" />
              <Cell label="هاتف العمل" value={p.guardianWorkPhone || '—'} dir="ltr" />
            </tr>

            <SectionTitle>قريب للطوارئ</SectionTitle>
            <tr>
              <Cell label="اسم القريب" value={p.relativeName} />
              <Cell label="الهاتف" value={p.relativePhone} dir="ltr" />
              <Cell label="العنوان" value={p.relativeAddress || '—'} colSpan={2} />
            </tr>

            {p.hasMedicalConditions ? (
              <>
                <SectionTitle>الحالات المرضية</SectionTitle>
                <tr>
                  <Cell label="التفاصيل" value={p.medicalDetails || '—'} colSpan={4} />
                </tr>
              </>
            ) : null}
          </tbody>
        </table>

        <p className="mt-3 text-xs text-slate-600">
          تم الإقرار إلكترونياً بتاريخ {formatSubmittedAt(submission.submittedAt)}
        </p>
      </div>

      <div className="flex justify-end border-t border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex min-w-[11rem] flex-col justify-center rounded-xl border-2 border-teal-500/70 px-4 py-3 text-center text-sm">
          <p className="font-bold text-slate-800">قائد المدرسة</p>
          <p className="mt-1 text-slate-600">{header.principalName?.trim() || 'اسم القائد'}</p>
        </div>
      </div>
    </section>
  )
}
