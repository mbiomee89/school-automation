/**
 * Smoke: gradebook subject map + avg math (no server required for map tests).
 * With API up: node scripts/smoke-gradebook.js --api
 */
import {
  resolveGradeShape,
  computeTermTotals,
  roundInt,
  GRADE_SHAPE,
} from '../backend/src/services/gradebook.js';

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

ok('math khitami', resolveGradeShape('الرياضيات', '5')?.shape === GRADE_SHAPE.KHITAMI);
ok('din takwini', resolveGradeShape('دين', '4')?.examsMax === 60);
ok('quran excluded', resolveGradeShape('القرآن الكريم', '4') == null);
ok('science g2 takwini', resolveGradeShape('العلوم', '2')?.shape === GRADE_SHAPE.TAKWINI);
ok('science g5 khitami', resolveGradeShape('العلوم', '5')?.shape === GRADE_SHAPE.KHITAMI);
ok('english g1 takwini', resolveGradeShape('اللغة الإنجليزية', '1')?.examsMax === 60);
ok('pe excluded', resolveGradeShape('التربية البدنية والدفاع عن النفس', '5') == null);
ok('round half up', roundInt(38.5) === 39);

const term = computeTermTotals(
  { assessment: 40, exams: 20 },
  { assessment: 36, exams: 18 },
  40,
  { assessmentMax: 40, examsMax: 20, finalMax: 40, periodMax: 60, shape: GRADE_SHAPE.KHITAMI }
);
ok('term avg+final', term.ready && term.total === 97, `total=${term.total}`);

const wait = computeTermTotals(
  { assessment: 40, exams: 20 },
  null,
  40,
  { assessmentMax: 40, examsMax: 20, finalMax: 40, periodMax: 60, shape: GRADE_SHAPE.KHITAMI }
);
ok('wait both periods', !wait.ready && wait.total == null);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
