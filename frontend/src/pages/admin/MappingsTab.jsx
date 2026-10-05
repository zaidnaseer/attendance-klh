import { useMemo, useState } from 'react';
import { mapFacultyToCourse, mapStudentToCourse, unmapFacultyCourse, unmapStudentCourse } from '../../lib/api';
import styles from './MappingsTab.module.css';

const label = (c) => (c.section ? `${c.course_code} · Sec ${c.section}` : c.course_code);
const matches = (text, q) => text.toLowerCase().includes(q.trim().toLowerCase());

export default function MappingsTab({ overview, onChanged, notify }) {
    const [selectedId, setSelectedId] = useState(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');

    const facultyByCourse = useMemo(() => {
        const m = new Map();
        overview.courseFaculties.forEach((x) => m.set(x.course_id, [...(m.get(x.course_id) || []), x]));
        return m;
    }, [overview.courseFaculties]);

    const studentsByCourse = useMemo(() => {
        const m = new Map();
        overview.courseStudents.forEach((x) => m.set(x.course_id, [...(m.get(x.course_id) || []), x]));
        return m;
    }, [overview.courseStudents]);

    const needsFaculty = overview.courses.filter((c) => !(facultyByCourse.get(c.id) || []).length).length;
    const emptyRoster = overview.courses.filter((c) => !(studentsByCourse.get(c.id) || []).length).length;

    const courses = overview.courses
        .filter((c) => matches(`${c.course_code} ${c.name} ${c.section || ''}`, search))
        .filter((c) => (filter === 'faculty' ? !(facultyByCourse.get(c.id) || []).length
            : filter === 'empty' ? !(studentsByCourse.get(c.id) || []).length : true))
        .sort((a, b) => a.name.localeCompare(b.name) || a.course_code.localeCompare(b.course_code));

    const selected = overview.courses.find((c) => c.id === selectedId) || null;

    return (
        <div className={styles.layout}>
            <div className={`${styles.panel} ${selected ? styles.hideOnDetail : ''}`}>
                <input className={styles.input} type="search" placeholder="Search courses" aria-label="Search courses" value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className={styles.chips} role="group" aria-label="Filter courses">
                    {[['all', `All (${overview.courses.length})`], ['faculty', `Needs faculty (${needsFaculty})`], ['empty', `No students (${emptyRoster})`]].map(([k, l]) => (
                        <button key={k} type="button" aria-pressed={filter === k} className={`${styles.chip} ${filter === k ? styles.chipOn : ''}`} onClick={() => setFilter(k)}>{l}</button>
                    ))}
                </div>
                <div className={styles.courseList}>
                    {courses.map((c) => {
                        const f = facultyByCourse.get(c.id) || [];
                        const s = studentsByCourse.get(c.id) || [];
                        return (
                            <button key={c.id} type="button" className={`${styles.courseRow} ${c.id === selectedId ? styles.courseRowOn : ''}`} onClick={() => setSelectedId(c.id)}>
                                <span className={styles.courseTop}>
                                    <span>{label(c)}</span>
                                    {f.length === 0 && <span className={`${styles.tag} ${styles.tagWarn}`}>No faculty</span>}
                                </span>
                                <span className={styles.sub}>{c.name}</span>
                                <span className={styles.sub}>{f.length} faculty · {s.length} students</span>
                            </button>
                        );
                    })}
                    {courses.length === 0 && <div className={styles.empty}>{overview.courses.length ? 'No courses match.' : 'Create a course first.'}</div>}
                </div>
            </div>

            {selected ? (
                <CourseDetail
                    key={selected.id}
                    course={selected}
                    overview={overview}
                    faculty={facultyByCourse.get(selected.id) || []}
                    students={studentsByCourse.get(selected.id) || []}
                    onBack={() => setSelectedId(null)}
                    onChanged={onChanged}
                    notify={notify}
                />
            ) : (
                <div className={`${styles.panel} ${styles.empty}`} style={{ display: 'grid', placeItems: 'center', minHeight: 200 }}>
                    Select a course to manage its faculty and students.
                </div>
            )}
        </div>
    );
}

function CourseDetail({ course, overview, faculty, students, onBack, onChanged, notify }) {
    const [addingFaculty, setAddingFaculty] = useState(false);
    const [facultyQ, setFacultyQ] = useState('');
    const [addingStudents, setAddingStudents] = useState(false);
    const [studentQ, setStudentQ] = useState('');
    const [rosterQ, setRosterQ] = useState('');
    const [picked, setPicked] = useState(new Set());
    const [busy, setBusy] = useState(false);

    const assignedFaculty = new Set(faculty.map((f) => f.faculty_id));
    const enrolled = new Set(students.map((s) => s.student_id));
    const freeFaculty = overview.faculties.filter((f) => !assignedFaculty.has(f.id) && matches(`${f.name} ${f.faculty_code}`, facultyQ));
    const freeStudents = overview.students.filter((s) => !enrolled.has(s.id) && matches(`${s.name} ${s.student_code}`, studentQ));
    const shownRoster = students.filter((s) => matches(`${s.student_name} ${s.student_code}`, rosterQ));

    async function run(fn, okTitle) {
        setBusy(true);
        try {
            await fn();
            notify({ type: 'success', title: okTitle, message: label(course) });
            await onChanged();
        } catch (error) {
            notify({ type: 'error', title: 'Update failed', message: error.message });
        } finally {
            setBusy(false);
        }
    }

    const assign = (id) => run(() => mapFacultyToCourse({ courseId: course.id, facultyId: id }), 'Faculty assigned')
        .then(() => { setAddingFaculty(false); setFacultyQ(''); });

    async function addPicked() {
        setBusy(true);
        const results = await Promise.allSettled([...picked].map((id) => mapStudentToCourse({ courseId: course.id, studentId: id })));
        const failed = results.filter((r) => r.status === 'rejected').length;
        notify(failed
            ? { type: 'error', title: 'Some students failed', message: `${results.length - failed} added, ${failed} failed` }
            : { type: 'success', title: `${results.length} student${results.length === 1 ? '' : 's'} added`, message: label(course) });
        setPicked(new Set());
        setBusy(false);
        await onChanged();
    }

    const toggle = (id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const allShownPicked = freeStudents.length > 0 && freeStudents.every((s) => picked.has(s.id));

    return (
        <div className={styles.panel}>
            <div className={styles.detailHead}>
                <button type="button" className={styles.back} onClick={onBack}>← Courses</button>
                <h3>{label(course)}</h3>
            </div>
            <div className={styles.sub}>{course.name}</div>

            <div className={styles.section} style={{ borderTop: 0, marginTop: 12, paddingTop: 0 }}>
                <div className={styles.sectionHead}>
                    <h4>Faculty ({faculty.length})</h4>
                    <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => setAddingFaculty((v) => !v)} aria-expanded={addingFaculty}>
                        {addingFaculty ? 'Close' : '+ Assign faculty'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {faculty.map((f) => (
                        <span className={styles.facultyChip} key={f.id}>
                            {f.faculty_name} <span className={styles.sub}>{f.faculty_code}</span>
                            <button type="button" className={styles.x} aria-label={`Remove ${f.faculty_name}`} disabled={busy} onClick={() => run(() => unmapFacultyCourse(f.id), 'Faculty removed')}>✕</button>
                        </span>
                    ))}
                    {faculty.length === 0 && <span className={`${styles.tag} ${styles.tagWarn}`}>No faculty assigned</span>}
                </div>
                {addingFaculty && (
                    <div className={styles.picker}>
                        <input className={styles.input} autoFocus type="search" placeholder="Search faculty" aria-label="Search faculty" value={facultyQ} onChange={(e) => setFacultyQ(e.target.value)} />
                        <div className={styles.pickList}>
                            {freeFaculty.map((f) => (
                                <button key={f.id} type="button" className={styles.pickRow} style={{ border: 0, color: 'inherit', font: 'inherit', textAlign: 'left' }} disabled={busy} onClick={() => assign(f.id)}>
                                    <span>{f.name}</span><span className={styles.sub}>{f.faculty_code}</span>
                                </button>
                            ))}
                            {freeFaculty.length === 0 && <div className={styles.empty}>No more faculty to assign.</div>}
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.section}>
                <div className={styles.sectionHead}>
                    <h4>Students ({students.length})</h4>
                    <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => { setAddingStudents((v) => !v); setPicked(new Set()); }} aria-expanded={addingStudents}>
                        {addingStudents ? 'Close' : '+ Add students'}
                    </button>
                </div>

                {addingStudents && (
                    <div className={styles.picker} style={{ marginBottom: 16 }}>
                        <input className={styles.input} autoFocus type="search" placeholder="Search students not in this course" aria-label="Search students to add" value={studentQ} onChange={(e) => setStudentQ(e.target.value)} />
                        <label className={styles.pickRow}>
                            <input type="checkbox" checked={allShownPicked} disabled={freeStudents.length === 0}
                                onChange={() => setPicked(allShownPicked ? new Set() : new Set(freeStudents.map((s) => s.id)))} />
                            <strong>Select all shown ({freeStudents.length})</strong>
                        </label>
                        <div className={styles.pickList}>
                            {freeStudents.map((s) => (
                                <label className={styles.pickRow} key={s.id}>
                                    <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
                                    <span style={{ flex: 1 }}>{s.name}</span><span className={styles.sub}>{s.student_code}</span>
                                </label>
                            ))}
                            {freeStudents.length === 0 && <div className={styles.empty}>No students available.</div>}
                        </div>
                        <div className={styles.addBar}>
                            <span className={styles.sub}>{picked.size} selected</span>
                            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={picked.size === 0 || busy} onClick={addPicked}>
                                {busy ? 'Adding…' : `Add ${picked.size || ''} student${picked.size === 1 ? '' : 's'}`}
                            </button>
                        </div>
                    </div>
                )}

                {students.length > 8 && (
                    <input className={styles.input} style={{ marginBottom: 8 }} type="search" placeholder="Search enrolled students" aria-label="Search enrolled students" value={rosterQ} onChange={(e) => setRosterQ(e.target.value)} />
                )}
                <div className={styles.rosterList}>
                    {shownRoster.map((s) => (
                        <div className={styles.rosterRow} key={s.id}>
                            <span>{s.student_name} <span className={styles.sub}>{s.student_code}</span></span>
                            <button type="button" className={styles.removeBtn} disabled={busy} onClick={() => run(() => unmapStudentCourse(s.id), 'Student removed')}>Remove</button>
                        </div>
                    ))}
                    {students.length === 0 && <div className={styles.empty}>No students yet. Use "+ Add students".</div>}
                    {students.length > 0 && shownRoster.length === 0 && <div className={styles.empty}>No matches.</div>}
                </div>
            </div>
        </div>
    );
}
