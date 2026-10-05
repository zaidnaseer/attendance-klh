import styles from './Faculty.parts.module.css';
import ClassPicker from './ClassPicker';
import LiveTab from './LiveTab';
import RosterTab from './RosterTab';
import HistoryTab from './HistoryTab';
import ReportsTab from './ReportsTab';

const TABS = [['live', 'Live'], ['roster', 'Roster'], ['history', 'History'], ['reports', 'Reports']];

export default function ClassView({ course, courses, allStudents, tab, onTab, onBack, onPick, actions, institution, savingMode, onOpenSession }) {
    return (
        <div>
            <div className={styles.viewHead}>
                <button type="button" className={styles.link} onClick={onBack}>← All classes</button>
                <ClassPicker courses={courses} current={course} onSelect={onPick} />
                <span className={styles.muted}>{course.name} · {course.students.length} students</span>
                {course.activeSession && <span className={styles.live}><span className={styles.liveDot} />LIVE</span>}
            </div>

            <div className={styles.tabs} role="tablist">
                {TABS.map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={tab === key}
                        className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
                        onClick={() => onTab(key)}
                    >
                        {label}
                        {key === 'live' && course.activeSession && <span className={styles.liveDot} aria-hidden="true" />}
                    </button>
                ))}
            </div>

            {tab === 'live' && <LiveTab course={course} actions={actions} institution={institution} savingMode={savingMode} />}
            {tab === 'roster' && <RosterTab course={course} allStudents={allStudents} actions={actions} />}
            {tab === 'history' && <HistoryTab course={course} onOpenSession={onOpenSession} />}
            {tab === 'reports' && <ReportsTab course={course} />}
        </div>
    );
}
