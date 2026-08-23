import type { ReactNode } from 'react'
import type { StudentProfilePayload, StudentProfileSubmission } from '../../api/studentProfile'

const PARENT_NOTE =
  'عزيزي ولي الأمر: أنت شريك في نجاح العملية التعليمية وتحقيق الانضباط المدرسي، فكن عوناً لنا.'

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
}: {
  label: string
  value?: ReactNode
  className?: string
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <td className={`border border-slate-700 px-1.5 py-1 align-top ${className ?? ''}`}>
      <div className="text-[10px] font-bold text-slate-600">{label}</div>
      <div className="min-h-[1.1rem] text-sm text-slate-900" dir={dir}>
        {value || '—'}
      </div>
    </td>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <tr>
      <th
        colSpan={12}
        className="border border-teal-800 bg-teal-700 px-2 py-1.5 text-start text-sm font-bold text-white"
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
  const blood =
    !p.bloodType || p.bloodType === 'UNKNOWN' ? 'لا أعرف' : p.bloodType
  const housing = p.housing ? HOUSING_AR[p.housing] || p.housing : '—'

  return (
    <section
      className="student-profile-print-sheet mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm print:mb-0 print:break-after-page print:rounded-none print:border-0 print:shadow-none"
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
        <table className="w-full border-collapse text-start">
          <tbody>
            <SectionTitle>البيانات الشخصية</SectionTitle>
            <tr>
              <Cell label="المرحلة الدراسية" value={p.stage || 'الابتدائية'} />
              <Cell label="الصف / الفصل" value={className} />
              <Cell label="الجنسية" value={p.nationality} />
              <Cell label="رقم السجل المدني / الإقامة" value={p.civilId} dir="ltr" className="w-[28%]" />
            </tr>
            <tr>
              <Cell label="رقم الطالب (خاص بالمدرسة)" value={studentId} dir="ltr" />
              <Cell label="تاريخ الهوية" value={p.idIssueDate || '—'} dir="ltr" />
              <Cell label="رقم جواز السفر" value={p.passportNumber || '—'} dir="ltr" />
              <Cell label="تاريخ الميلاد" value={p.birthDate} dir="ltr" />
            </tr>
            <tr>
              <Cell label="الاسم رباعياً (عربي)" value={p.nameAr} className="w-[40%]" />
              <Cell label="English name" value={enName(p)} dir="ltr" className="w-[60%]" />
            </tr>
            <tr>
              <Cell label="Name" value={p.nameEnFirst} dir="ltr" />
              <Cell label="FATHER" value={p.nameEnFather} dir="ltr" />
              <Cell label="Grand Father" value={p.nameEnGrand} dir="ltr" />
              <Cell label="FAMILY" value={p.nameEnFamily} dir="ltr" />
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
            </tr>
            <tr>
              <Cell label="الشارع الرئيسي" value={p.streetMain} />
              <Cell label="الشارع الفرعي" value={p.streetSub || '—'} />
              <Cell label="رقم المنزل" value={p.houseNumber} />
            </tr>
            <tr>
              <Cell label="البريد الإلكتروني" value={p.email} dir="ltr" />
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
              <Cell label="العنوان" value={p.relativeAddress || '—'} className="w-[40%]" />
            </tr>

            {p.hasMedicalConditions ? (
              <>
                <SectionTitle>الحالات المرضية</SectionTitle>
                <tr>
                  <Cell label="التفاصيل" value={p.medicalDetails || '—'} className="w-full" />
                </tr>
              </>
            ) : null}
          </tbody>
        </table>

        <div className="mt-4 space-y-2 text-sm">
          <p>
            اسم الطالب: <span className="font-semibold">{p.nameAr}</span>
            <span className="ms-4 text-slate-500">التوقيع على صحة البيانات: ........................</span>
          </p>
          <p>
            اسم ولي الأمر: <span className="font-semibold">{p.guardianName}</span>
            <span className="ms-4 text-slate-500">التوقيع على صحة البيانات: ........................</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
        <p className="text-sm font-bold text-teal-700">ملاحظات:</p>
        <div className="min-w-[12rem] flex-1 rounded-xl border-2 border-teal-500/70 px-3 py-2 text-sm leading-6 text-slate-700">
          {PARENT_NOTE}
        </div>
        <div className="flex min-w-[9rem] flex-col justify-center rounded-xl border-2 border-teal-500/70 px-3 py-2 text-center text-sm">
          <p className="font-bold text-slate-800">قائد المدرسة</p>
          <p className="mt-1 text-slate-600">{header.principalName?.trim() || 'اسم القائد'}</p>
        </div>
      </div>
    </section>
  )
}
