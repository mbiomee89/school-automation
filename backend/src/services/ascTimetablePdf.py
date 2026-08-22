#!/usr/bin/env python3
"""
Parse aSc Timetables PDFs (teachers / class / general) into JSON lesson slots.

Preferred: teachers table.pdf — one page per teacher, cell = class + subject.
Also accepts class table.pdf and general table.pdf.

Stdout or --out file:
  {"view","fileName","slotCount","slots":[{teacherName,classLabel,subjectName,dayOfWeek,period}],"errors":[]}
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

try:
    import fitz
except ImportError:
    Path(sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "/dev/stdout").write_text(
        json.dumps({"error": "pymupdf missing: pip install pymupdf", "slots": [], "errors": []}),
        encoding="utf-8",
    ) if "--out" in sys.argv else print(
        json.dumps({"error": "pymupdf missing: pip install pymupdf", "slots": [], "errors": []})
    )
    sys.exit(2)


def fix_line(s: str) -> str:
    s = (s or "").replace("\u200f", "").replace("\u200e", "").strip()
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    return re.sub(r"\s+", " ", s).strip()


def visual_to_logical(s: str) -> str:
    """Body cells in aSc exports are character-reversed Arabic."""
    s = fix_line(s)
    return "".join(reversed(s)) if s else s


def fix_multiline(raw: str) -> list[str]:
    return [visual_to_logical(p) for p in (raw or "").split("\n") if fix_line(p)]


def normalize_day(raw: str) -> str | None:
    # دحا → احد, نينثا → اثنين, ءاثلاث → ثالثاء, ءاعبرا → اربعاء, سيمخ → خميس
    s = visual_to_logical(str(raw or "")).replace(" ", "")
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    if s.startswith("ال"):
        s = s[2:]
    if s == "ثالثاء":
        s = "ثلاثاء"
    mapping = {
        "احد": "SUN",
        "اثنين": "MON",
        "ثلاثاء": "TUE",
        "اربعاء": "WED",
        "خميس": "THU",
    }
    if s in mapping:
        return mapping[s]
    if "ثلاث" in s:
        return "TUE"
    if "ثن" in s:
        return "MON"
    if "ربع" in s:
        return "WED"
    if "خمي" in s:
        return "THU"
    if "حد" in s:
        return "SUN"
    return None


def normalize_class_label(raw: str) -> str:
    """Force 'أول أ' (grade then section). Input may already be logical."""
    candidates = [fix_line(raw), visual_to_logical(raw)]
    grade_pat = r"(أول|اول|ثاني|ثان|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع)"
    sec_pat = r"([أبجدهو])"
    for cand in candidates:
        cand = re.sub(r"\s+", " ", cand).strip()
        m = re.match(rf"^{grade_pat}\s*{sec_pat}$", cand)
        if m:
            g, sec = m.group(1), m.group(2)
            if g == "اول":
                g = "أول"
            if g == "ثاني":
                g = "ثان"
            return f"{g} {sec}"
        m = re.match(rf"^{sec_pat}\s*{grade_pat}$", cand)
        if m:
            sec, g = m.group(1), m.group(2)
            if g == "اول":
                g = "أول"
            if g == "ثاني":
                g = "ثان"
            return f"{g} {sec}"
        glued = cand.replace(" ", "")
        m = re.match(rf"^{grade_pat}{sec_pat}$", glued)
        if m:
            return f"{m.group(1)} {m.group(2)}"
        m = re.match(rf"^{sec_pat}{grade_pat}$", glued)
        if m:
            return f"{m.group(2)} {m.group(1)}"
    return fix_line(raw)


def normalize_subject(raw: str) -> str:
    # Already logical if from fix_multiline; still try reverse as fallback
    for cand in (fix_line(raw), visual_to_logical(raw)):
        if cand in {"E", "e"}:
            return "E"
        if cand in {
            "عربي",
            "دين",
            "رياضيات",
            "علوم",
            "قرآن",
            "فنية",
            "بدنية",
            "حياتية",
            "رقمية",
            "اجتماعية",
        }:
            return "قرآن" if cand == "قران" else cand
        if cand == "قران":
            return "قرآن"
    return fix_line(raw)


def normalize_person_name(raw: str) -> str:
    s = fix_line(raw)
    # Collapse OCR/aSc broken letters: "ص لا ح" → "صلاح", "ع لا ء" → "علاء"
    for _ in range(4):
        s = re.sub(r"\b([\u0600-\u06FF]) ([\u0600-\u06FF]) ([\u0600-\u06FF])\b", r"\1\2\3", s)
        s = re.sub(r"\b([\u0600-\u06FF]) ([\u0600-\u06FF])\b", r"\1\2", s)
    candidates = [
        s,
        "".join(reversed(s)),
        " ".join("".join(reversed(w)) for w in s.split()),
    ]

    def score(name: str) -> int:
        if not name:
            return -100
        sc = len(name)
        for good in (
            "إبراهيم",
            "محمد",
            "أحمد",
            "علي",
            "حسن",
            "رياض",
            "سلطان",
            "ناصر",
            "عطية",
            "مجاهد",
            "عيسى",
            "صالح",
            "صلاح",
            "حمدي",
            "سمير",
            "خرمي",
            "زكي",
            "بكري",
            "سعد",
            "علاء",
            "عبد",
        ):
            if good in name:
                sc += 8
        return sc

    best = s
    for cand in candidates:
        cand = re.sub(r"\s+", " ", cand).strip()
        if score(cand) > score(best):
            best = cand
    return best


def looks_like_class(s: str) -> bool:
    return any(g in s.replace(" ", "") for g in ("أول", "اول", "ثان", "ثالث", "رابع", "خامس", "سادس"))


def looks_like_subject(s: str) -> bool:
    keys = (
        "عربي",
        "دين",
        "رياض",
        "علوم",
        "قرآن",
        "قران",
        "فنية",
        "بدنية",
        "حيات",
        "رقمية",
        "اجتماع",
        "E",
    )
    return any(k.lower() in s.lower() for k in keys) or s.strip() in {"E", "e"}


def detect_view(doc) -> str:
    if doc.page_count >= 18:
        return "teachers"
    if doc.page_count >= 10:
        return "class"
    return "general"


def page_top_words(page) -> list[str]:
    words = []
    for w in page.get_text("words"):
        if w[1] >= 58:
            continue
        t = fix_line(w[4])
        if not t or "/" in t or re.fullmatch(r"\d+", t):
            continue
        low = t.lower()
        if low in {"asc", "timetables"} or "إنشاء" in t or "الجدول" in t:
            continue
        words.append(t)
    return words


def period_columns(header_row) -> list[tuple[int, str]]:
    cols = []
    for ci, cell in enumerate(header_row):
        t = str(cell or "").strip()
        if t.isdigit() and 1 <= int(t) <= 8:
            cols.append((ci, t))
    return cols


def day_from_row(row) -> str | None:
    day = normalize_day(str(row[-1] or ""))
    if day:
        return day
    for cell in row:
        day = normalize_day(str(cell or ""))
        if day:
            return day
    return None


def parse_teachers_view(doc):
    slots, errors = [], []
    for pi, page in enumerate(doc):
        teacher_name = normalize_person_name(" ".join(page_top_words(page)[:4]))
        tables = page.find_tables()
        if not tables.tables:
            errors.append({"page": pi + 1, "error": "no table"})
            continue
        data = tables.tables[0].extract()
        if not data:
            continue
        pcols = period_columns(data[0])
        for row in data[1:]:
            day = day_from_row(row)
            if not day:
                continue
            for ci, period in pcols:
                if ci >= len(row):
                    continue
                parts = fix_multiline(row[ci] or "")
                if len(parts) < 2:
                    continue
                a, b = parts[0], parts[1]
                if looks_like_class(a) and looks_like_subject(b):
                    class_label, subject_name = a, b
                elif looks_like_subject(a) and looks_like_class(b):
                    subject_name, class_label = a, b
                else:
                    class_label, subject_name = a, b
                slots.append(
                    {
                        "teacherName": teacher_name,
                        "classLabel": normalize_class_label(class_label),
                        "subjectName": normalize_subject(subject_name),
                        "dayOfWeek": day,
                        "period": str(period),
                        "sourcePage": pi + 1,
                    }
                )
    return slots, errors


def parse_class_view(doc):
    slots, errors = [], []
    for pi, page in enumerate(doc):
        top = page_top_words(page)
        class_tokens = [w for w in top if looks_like_class(w) or w in {"أ", "ب", "ج", "د"}]
        if len(class_tokens) >= 2:
            class_label = normalize_class_label(f"{class_tokens[0]} {class_tokens[1]}")
        elif class_tokens:
            class_label = normalize_class_label(class_tokens[0])
        else:
            class_label = normalize_class_label(" ".join(top[:2]))

        tables = page.find_tables()
        if not tables.tables:
            errors.append({"page": pi + 1, "error": "no table"})
            continue
        data = tables.tables[0].extract()
        pcols = period_columns(data[0])
        for row in data[1:]:
            day = day_from_row(row)
            if not day:
                continue
            for ci, period in pcols:
                parts = fix_multiline(row[ci] or "")
                if len(parts) < 2:
                    continue
                if looks_like_subject(parts[0]):
                    subject_name, teacher_name = parts[0], " ".join(parts[1:])
                else:
                    teacher_name, subject_name = parts[0], parts[-1]
                slots.append(
                    {
                        "teacherName": normalize_person_name(teacher_name),
                        "classLabel": class_label,
                        "subjectName": normalize_subject(subject_name),
                        "dayOfWeek": day,
                        "period": str(period),
                        "sourcePage": pi + 1,
                    }
                )
    return slots, errors


def parse_general_view(doc):
    slots, errors = [], []
    page = doc[0]
    tables = page.find_tables()
    if not tables.tables:
        return [], [{"error": "no general table"}]
    data = tables.tables[0].extract()
    if len(data) < 3:
        return [], [{"error": "short general table"}]

    # Day headers in general view are often already logical (or reversed) in row0
    day_headers = []
    for cell in data[0]:
        d = normalize_day(str(cell or ""))
        if not d:
            # try without reverse — raw logical
            raw = fix_line(str(cell or "")).replace(" ", "")
            raw = raw.replace("أ", "ا").replace("إ", "ا")
            for k, v in {
                "الخميس": "THU",
                "خميس": "THU",
                "الاربعاء": "WED",
                "اربعاء": "WED",
                "الثلاثاء": "TUE",
                "ثلاثاء": "TUE",
                "الاثنين": "MON",
                "اثنين": "MON",
                "الاحد": "SUN",
                "احد": "SUN",
            }.items():
                if k.replace("أ", "ا") in raw or raw in k.replace("أ", "ا"):
                    d = v
                    break
        if d:
            day_headers.append(d)

    period_indices = []
    for ci, cell in enumerate(data[1]):
        t = str(cell or "").strip()
        if t.isdigit():
            period_indices.append((ci, t))

    groups = [period_indices[i : i + 6] for i in range(0, len(period_indices), 6)]
    while len(day_headers) < len(groups):
        day_headers.append(None)
    day_headers = day_headers[: len(groups)]

    col_meta = []
    for gi, group in enumerate(groups):
        day = day_headers[gi]
        if not day:
            continue
        for ci, period in group:
            col_meta.append((ci, day, period))

    for ri, row in enumerate(data[2:], start=2):
        teacher_name = normalize_person_name(fix_line((row[-1] or "").replace("\n", " ")))
        if not teacher_name:
            continue
        for ci, day, period in col_meta:
            if ci >= len(row):
                continue
            parts = fix_multiline(row[ci] or "")
            if len(parts) < 2:
                continue
            if looks_like_subject(parts[0]) and looks_like_class(parts[1]):
                subject_name, class_label = parts[0], parts[1]
            else:
                class_label, subject_name = parts[1], parts[0]
                if looks_like_class(parts[0]):
                    class_label, subject_name = parts[0], parts[1]
            slots.append(
                {
                    "teacherName": teacher_name,
                    "classLabel": normalize_class_label(class_label),
                    "subjectName": normalize_subject(subject_name),
                    "dayOfWeek": day,
                    "period": str(period),
                    "sourcePage": 1,
                    "sourceRow": ri,
                }
            )
    return slots, errors


def write_payload(payload: dict, out_path: str | None):
    text = json.dumps(payload, ensure_ascii=False)
    if out_path:
        Path(out_path).write_text(text, encoding="utf-8")
    else:
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
        print(text)


def main():
    args = sys.argv[1:]
    out_path = None
    if "--out" in args:
        i = args.index("--out")
        out_path = args[i + 1] if i + 1 < len(args) else None
        args = args[:i] + args[i + 2 :]

    if not args:
        write_payload({"error": "usage: ascTimetablePdf.py <file.pdf> [--out out.json]", "slots": []}, out_path)
        sys.exit(1)

    path = Path(args[0])
    if not path.exists():
        write_payload({"error": f"missing file: {path}", "slots": []}, out_path)
        sys.exit(1)

    doc = fitz.open(path)
    view = detect_view(doc)
    if view == "teachers":
        slots, errors = parse_teachers_view(doc)
    elif view == "class":
        slots, errors = parse_class_view(doc)
    else:
        slots, errors = parse_general_view(doc)
    doc.close()

    seen, unique = set(), []
    for s in slots:
        key = (s["teacherName"], s["classLabel"], s["subjectName"], s["dayOfWeek"], s["period"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(s)

    write_payload(
        {
            "view": view,
            "fileName": path.name,
            "slotCount": len(unique),
            "slots": unique,
            "errors": errors,
        },
        out_path,
    )


if __name__ == "__main__":
    main()
