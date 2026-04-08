import styles from './OverviewTab.module.css';

export default function OverviewTab({ overview, totalMappings, getInitials, getAvatarStyle }) {
    return (
        <>
            <div className={styles.overviewGrid}>
                <div className={`${styles.metricCard} ${styles.accent}`}>
                    <div className={styles.metricLabel}>Faculty</div>
                    <div className={styles.metricValue}>{overview.faculties.length}</div>
                    <div className={styles.metricSub}>registered members</div>
                </div>
                <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>Students</div>
                    <div className={styles.metricValue}>{overview.students.length}</div>
                    <div className={styles.metricSub}>enrolled</div>
                </div>
                <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>Courses</div>
                    <div className={styles.metricValue}>{overview.courses.length}</div>
                    <div className={styles.metricSub}>active</div>
                </div>
                <div className={styles.metricCard}>
                    <div className={styles.metricLabel}>Mappings</div>
                    <div className={styles.metricValue}>{totalMappings}</div>
                    <div className={styles.metricSub}>total assignments</div>
                </div>
            </div>

            <div className={styles.overviewRecent}>
                <div className={styles.recentCard}>
                    <div className={styles.recentTitle}>Recent Faculty</div>
                    {overview.faculties.length > 0 ? (
                        <div className={styles.recentList}>
                            {overview.faculties
                                .slice(0, 4)
                                .map((f, i) => (
                                    <div className={styles.recentItem} key={f.id}>
                                        <div className={`${styles.riAvatar} ${styles[getAvatarStyle(i)]}`}>
                                            {getInitials(f.name)}
                                        </div>
                                        <div>
                                            <div className={styles.riName}>{f.name}</div>
                                            <div className={styles.riSub}>{f.faculty_code}</div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className={styles.noData}>No faculty added yet</div>
                    )}
                </div>

                <div className={styles.recentCard}>
                    <div className={styles.recentTitle}>Recent Students</div>
                    {overview.students.length > 0 ? (
                        <div className={styles.recentList}>
                            {overview.students
                                .slice(0, 4)
                                .map((s) => (
                                    <div className={styles.recentItem} key={s.id}>
                                        <div className={`${styles.riAvatar} ${styles.bgTeal}`}>{getInitials(s.name)}</div>
                                        <div>
                                            <div className={styles.riName}>{s.name}</div>
                                            <div className={styles.riSub}>{s.student_code}</div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className={styles.noData}>No students added yet</div>
                    )}
                </div>
            </div>
        </>
    );
}
