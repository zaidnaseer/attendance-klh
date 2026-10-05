import { useEffect, useMemo, useState } from 'react';
import styles from './Faculty.parts.module.css';
import { studentStats, THRESHOLD } from './utils';

const PAGE_SIZE = 25;

function RowMenu({ onRemove }) {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);
    return (
        <div className={styles.menuWrap}>
            <button type="button" className={styles.menuBtn} aria-label="Student actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>⋯</button>
            {open && (
                <>
                    <div className={styles.pickerBackdrop} style={{ background: 'transparent' }} onClick={() => setOpen(false)} />
                    <div className={styles.menu} role="menu" style={{ zIndex: 901 }}>
                        <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { setOpen(false); onRemove(); }}>
                            Remove from class
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export default function RosterTab({ course, allStudents, actions }) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [page, setPage] = useState(0);
    const [adding, setAdding] = useState(false);
    const [toAdd, setToAdd] = useState('');

    const stats = useMemo(() => studentStats(course), [course]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return course.students.filter((s) => {
            if (q && !`${s.student_code} ${s.name}`.toLowerCase().includes(q)) return false;
            if (filter === 'low') {
                const pct = stats.get(s.id)?.pct;
                return pct !== null && pct < THRESHOLD;
            }
            if (filter === 'unenrolled') return !s.enrolled;
            return true;
        });
    }, [course.students, search, filter, stats]);

    useEffect(() => setPage(0), [search, filter, course.id]);

    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const rosterIds = new Set(course.students.map((s) => s.id));
    const available = allStudents.filter((s) => !rosterIds.has(s.id));
    const lowCount = course.students.filter((s) => { const p = stats.get(s.id)?.pct; return p !== null && p < THRESHOLD; }).length;
    const unenrolledCount = course.students.filter((s) => !s.enrolled).length;

    return (
        <div className={styles.stack}>
            <div className={styles.sticky}>
                <div className={styles.row2}>
                    <input
                        className={styles.input}
                        style={{ flex: 1, minWidth: 160 }}
                        type="search"
                        aria-label="Search students"
                        placeholder={`Search ${course.students.length} students`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button type="button" className={`${styles.btn} ${styles.btnGhost}`} aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
                        {adding ? 'Close' : '+ Add student'}
                    </button>
                </div>
                <div className={styles.filters} role="group" aria-label="Filter students">
                    {[['all', `All (${course.students.length})`], ['low', `Below ${THRESHOLD}% (${lowCount})`], ['unenrolled', `Not face-enrolled (${unenrolledCount})`]].map(([key, label]) => (
                        <button key={key} type="button" aria-pressed={filter === key} className={`${styles.chip} ${filter === key ? styles.chipActive : ''}`} onClick={() => setFilter(key)}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {adding && (
                <div className={styles.addRow}>
                    <select className={styles.input} aria-label="Student to add" value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
                        <option value="">Select a student</option>
                        {available.map((s) => <option key={s.id} value={s.id}>{s.student_code} - {s.name}</option>)}
                    </select>
                    <button
                        type="button"
                        className={styles.btn}
                        disabled={!toAdd}
                        onClick={async () => { await actions.addStudent(course.id, toAdd); setToAdd(''); }}
                    >
                        Add
                    </button>
                </div>
            )}

            <div>
                <div className={styles.tableHead}>
                    <span>ID</span><span>Name</span><span>Overall</span><span>Face</span><span />
                </div>
                <div className={styles.list}>
                    {visible.map((s) => {
                        const pct = stats.get(s.id)?.pct;
                        const low = pct !== null && pct < THRESHOLD;
                        return (
                            <div className={`${styles.tableRow} ${low ? styles.rowLow : ''}`} key={s.id}>
                                <span className={styles.cellCode}>{s.student_code}</span>
                                <span className={`${styles.cellName} ${styles.itemName}`}>{s.name}</span>
                                <span className={styles.cellPct}>{pct === null ? '—' : `${pct}%`}</span>
                                <span className={styles.cellEnr}>
                                    <span className={`${styles.chip} ${s.enrolled ? '' : styles.chipWarn}`}>{s.enrolled ? 'Enrolled' : 'Pending'}</span>
                                </span>
                                <span className={styles.cellMenu}>
                                    <RowMenu
                                        onRemove={() => actions.confirm({
                                            title: `Remove ${s.name}?`,
                                            message: `${s.name} will be removed from ${course.course_code}.`,
                                            confirmLabel: 'Remove',
                                            onConfirm: () => actions.removeStudent(course.id, s.id),
                                        })}
                                    />
                                </span>
                            </div>
                        );
                    })}
                    {course.students.length === 0 && <p className={styles.empty}>No students in this class yet. Use "Add student".</p>}
                    {course.students.length > 0 && filtered.length === 0 && <p className={styles.empty}>No students match.</p>}
                </div>
            </div>

            {pages > 1 && (
                <div className={styles.pager}>
                    <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span className={styles.muted}>Page {page + 1} of {pages}</span>
                    <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
            )}
        </div>
    );
}
