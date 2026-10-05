import styles from './Faculty.parts.module.css';
import { lastSessionPct } from './utils';

export default function ClassCard({ course, onOpen, onStart }) {
    const live = !!course.activeSession;
    const pct = lastSessionPct(course);
    const present = (course.attendance || []).length;

    return (
        <div
            className={`${styles.card} ${live ? styles.cardLive : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(course.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(course.id))}
            aria-label={`Open ${course.course_code}`}
        >
            <div className={styles.cardTop}>
                <div>
                    <div className={styles.cardTitle}>
                        {course.course_code}
                        {course.section && <span className={`${styles.chip} ${styles.chipSection}`}>Section {course.section}</span>}
                    </div>
                    <div className={styles.muted}>{course.name}</div>
                </div>
                {live && <span className={styles.live}><span className={styles.liveDot} />LIVE</span>}
            </div>

            <div className={styles.cardStats}>
                <span>{course.students.length} students</span>
                <span>
                    {live
                        ? `${present} / ${course.students.length} present`
                        : pct !== null ? `Last class: ${pct}%` : 'No sessions yet'}
                </span>
            </div>

            {!live && pct !== null && (
                <div className={styles.bar} aria-hidden="true">
                    <div className={`${styles.barFill} ${pct < 75 ? styles.barLow : ''}`} style={{ width: `${pct}%` }} />
                </div>
            )}

            {live ? (
                <button type="button" className={styles.btn} onClick={(e) => { e.stopPropagation(); onOpen(course.id, 'live'); }}>
                    View live
                </button>
            ) : (
                <button type="button" className={styles.btn} onClick={(e) => { e.stopPropagation(); onStart(course.id); }}>
                    Start session
                </button>
            )}
        </div>
    );
}
