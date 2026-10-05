import styles from './Faculty.parts.module.css';

export default function HistoryTab({ course, onOpenSession }) {
    const past = course.pastSessions || [];
    if (past.length === 0) {
        return <p className={styles.empty}>No past sessions yet. Finished sessions appear here.</p>;
    }
    const total = course.students.length;
    return (
        <div className={styles.list}>
            {past.map((s) => {
                const pct = total ? Math.round((Number(s.present_count) / total) * 100) : 0;
                return (
                    <div
                        key={s.id}
                        className={styles.item}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onOpenSession({ ...s, course })}
                        onKeyDown={(e) => e.key === 'Enter' && onOpenSession({ ...s, course })}
                    >
                        <span className={styles.itemMain}>
                            <span>{new Date(s.started_at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                            <span className={styles.itemSub}>{new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                        <span style={{ width: '40%', display: 'grid', gap: 4 }}>
                            <span className={styles.muted} style={{ fontSize: '0.85rem', textAlign: 'right' }}>{s.present_count} / {total} · {pct}%</span>
                            <span className={styles.bar}><span className={`${styles.barFill} ${pct < 75 ? styles.barLow : ''}`} style={{ width: `${pct}%`, display: 'block' }} /></span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
