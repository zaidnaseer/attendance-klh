import { useMemo } from 'react';
import styles from './Faculty.parts.module.css';
import { downloadCsv, studentStats, THRESHOLD } from './utils';

export default function ReportsTab({ course }) {
    const rows = useMemo(() => {
        const stats = studentStats(course);
        return course.students
            .map((s) => ({ ...s, ...stats.get(s.id) }))
            .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || a.student_code.localeCompare(b.student_code));
    }, [course]);

    const sessions = (course.pastSessions || []).length;
    if (sessions === 0) {
        return <p className={styles.empty}>Reports appear after your first completed session.</p>;
    }

    const low = rows.filter((r) => r.pct !== null && r.pct < THRESHOLD).length;
    const avg = rows.length ? Math.round(rows.reduce((a, r) => a + (r.pct || 0), 0) / rows.length) : 0;

    return (
        <div className={styles.stack}>
            <div className={styles.summary}>
                <span className={styles.summaryBig}>{avg}% average</span>
                <span className={styles.muted}>{sessions} sessions · {low} student{low === 1 ? '' : 's'} below {THRESHOLD}%</span>
                <button
                    type="button"
                    className={styles.btn}
                    style={{ marginLeft: 'auto' }}
                    onClick={() => downloadCsv(`${course.course_code}-attendance-summary.csv`, [
                        ['student_code', 'name', 'attended', 'total_sessions', 'percent'],
                        ...rows.map((r) => [r.student_code, r.name, r.attended, r.total, r.pct]),
                    ])}
                >
                    Export CSV
                </button>
            </div>
            <div className={styles.list}>
                {rows.map((r) => (
                    <div className={`${styles.item} ${r.pct < THRESHOLD ? styles.rowLow : ''}`} key={r.id}>
                        <span className={styles.itemMain}>
                            <span className={styles.itemName}>{r.name}</span>
                            <span className={styles.itemSub}>{r.student_code} · {r.attended}/{r.total} classes</span>
                        </span>
                        <span style={{ width: '38%', display: 'grid', gap: 4 }}>
                            <strong style={{ textAlign: 'right' }}>{r.pct}%</strong>
                            <span className={styles.bar}><span className={`${styles.barFill} ${r.pct < THRESHOLD ? styles.barLow : ''}`} style={{ width: `${r.pct}%`, display: 'block' }} /></span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
