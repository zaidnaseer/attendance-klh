import { useMemo, useState } from 'react';
import ClassCard from './ClassCard';
import styles from './Faculty.parts.module.css';
import { groupBySubject } from './utils';

export default function ClassesHome({ courses, onOpen, onStart }) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q
            ? courses.filter((c) => `${c.name} ${c.course_code} ${c.section || ''}`.toLowerCase().includes(q))
            : courses;
    }, [courses, search]);

    const groups = useMemo(() => groupBySubject(filtered), [filtered]);
    const liveCount = courses.filter((c) => c.activeSession).length;

    return (
        <div>
            <div className={styles.homeHead}>
                <h2>
                    Your classes <span className={styles.muted} style={{ fontSize: '0.9rem', fontWeight: 400 }}>
                        {courses.length}{liveCount ? ` · ${liveCount} live` : ''}
                    </span>
                </h2>
                {courses.length > 6 && (
                    <input
                        className={styles.input}
                        type="search"
                        aria-label="Search classes"
                        placeholder="Search classes"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                )}
            </div>

            {courses.length === 0 && <p className={styles.empty}>No classes are assigned to you yet. Ask an admin to map you to a course.</p>}
            {courses.length > 0 && filtered.length === 0 && <p className={styles.empty}>No classes match "{search}".</p>}

            {groups.map((g) => (
                <section className={styles.group} key={g.subject}>
                    <h3 className={styles.groupTitle}>{g.subject}</h3>
                    <div className={styles.grid}>
                        {g.items.map((c) => <ClassCard key={c.id} course={c} onOpen={onOpen} onStart={onStart} />)}
                    </div>
                </section>
            ))}
        </div>
    );
}
