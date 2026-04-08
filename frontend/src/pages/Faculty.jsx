import { useEffect, useMemo, useState } from 'react';
import {
    facultyAddStudent,
    facultyRemoveStudent,
    getFacultyDashboard,
    startAttendanceSession,
} from '../lib/api';
import Toast from '../components/Toast';
import styles from './Faculty.module.css';

export default function Faculty() {
    const [facultyCode, setFacultyCode] = useState('');
    const [activeCode, setActiveCode] = useState('');
    const [dashboard, setDashboard] = useState(null);
    const [selectedByCourse, setSelectedByCourse] = useState({});
    const [toast, setToast] = useState(null);

    async function loadDashboard(code = activeCode) {
        if (!code) {
            return;
        }
        try {
            const data = await getFacultyDashboard(code);
            setDashboard(data);
        } catch (error) {
            setDashboard(null);
            setToast({ type: 'error', title: 'Load failed', message: error.message });
        }
    }

    useEffect(() => {
        if (!activeCode) {
            return undefined;
        }
        loadDashboard(activeCode);
        const interval = setInterval(() => loadDashboard(activeCode), 7000);
        return () => clearInterval(interval);
    }, [activeCode]);

    function submitCode(event) {
        event.preventDefault();
        if (!facultyCode.trim()) {
            return;
        }
        const code = facultyCode.trim();
        setActiveCode(code);
        loadDashboard(code);
    }

    async function addStudent(courseId) {
        const studentId = selectedByCourse[courseId];
        if (!studentId || !activeCode) {
            return;
        }

        try {
            await facultyAddStudent(activeCode, courseId, studentId);
            setToast({ type: 'success', title: 'Student added', message: 'Roster updated' });
            loadDashboard(activeCode);
        } catch (error) {
            setToast({ type: 'error', title: 'Add student failed', message: error.message });
        }
    }

    async function removeStudent(courseId, studentId) {
        if (!activeCode) {
            return;
        }
        try {
            await facultyRemoveStudent(activeCode, courseId, studentId);
            setToast({ type: 'success', title: 'Student removed', message: 'Roster updated' });
            loadDashboard(activeCode);
        } catch (error) {
            setToast({ type: 'error', title: 'Remove student failed', message: error.message });
        }
    }

    async function startSession(courseId) {
        if (!activeCode) {
            return;
        }
        try {
            await startAttendanceSession(activeCode, courseId);
            setToast({ type: 'success', title: 'Session started', message: 'Attendance is now active' });
            loadDashboard(activeCode);
        } catch (error) {
            setToast({ type: 'error', title: 'Start session failed', message: error.message });
        }
    }

    const allStudents = useMemo(() => dashboard?.allStudents || [], [dashboard]);

    return (
        <main className={styles.page}>
            <Toast toast={toast} />
            <section className={styles.panel}>
                <h1>Faculty Dashboard</h1>
                <form className={styles.form} onSubmit={submitCode}>
                    <input
                        className={styles.input}
                        value={facultyCode}
                        onChange={(event) => setFacultyCode(event.target.value)}
                        placeholder="Enter faculty code"
                    />
                    <button className={styles.button} type="submit">Load</button>
                </form>
            </section>

            {dashboard ? (
                <section className={styles.panel}>
                    <h2>{dashboard.faculty.name} ({dashboard.faculty.faculty_code})</h2>
                    <div className={styles.courseGrid}>
                        {dashboard.courses.map((course) => {
                            const rosterIds = new Set(course.students.map((student) => student.id));
                            const available = allStudents.filter((student) => !rosterIds.has(student.id));
                            const selectedValue = selectedByCourse[course.id] || '';

                            return (
                                <article className={styles.courseCard} key={course.id}>
                                    <header className={styles.courseHeader}>
                                        <div>
                                            <h3>{course.course_code}</h3>
                                            <p>{course.name}</p>
                                        </div>
                                        <button className={styles.button} type="button" onClick={() => startSession(course.id)}>
                                            Start Session
                                        </button>
                                    </header>

                                    <p className={styles.meta}>
                                        {course.activeSession ? `Active session started at ${new Date(course.activeSession.started_at).toLocaleString()}` : 'No active session'}
                                    </p>

                                    <div className={styles.inlineForm}>
                                        <select
                                            className={styles.input}
                                            value={selectedValue}
                                            onChange={(event) => setSelectedByCourse((previous) => ({ ...previous, [course.id]: event.target.value }))}
                                        >
                                            <option value="">Add student to course</option>
                                            {available.map((student) => (
                                                <option key={student.id} value={student.id}>{student.student_code} - {student.name}</option>
                                            ))}
                                        </select>
                                        <button className={styles.button} type="button" onClick={() => addStudent(course.id)} disabled={!selectedValue}>
                                            Add
                                        </button>
                                    </div>

                                    <h4>Roster</h4>
                                    <div className={styles.list}>
                                        {course.students.map((student) => (
                                            <div className={styles.row} key={student.id}>
                                                <span>{student.student_code} - {student.name}</span>
                                                <button className={styles.delete} type="button" onClick={() => removeStudent(course.id, student.id)}>Remove</button>
                                            </div>
                                        ))}
                                        {course.students.length === 0 ? <p className={styles.empty}>No students yet.</p> : null}
                                    </div>

                                    <h4>Present (Active Session)</h4>
                                    <div className={styles.list}>
                                        {course.attendance.map((record) => (
                                            <div className={styles.row} key={record.id}>
                                                <span>{record.student_code} - {record.name}</span>
                                                <span className={styles.presentTag}>Present</span>
                                            </div>
                                        ))}
                                        {course.attendance.length === 0 ? <p className={styles.empty}>No attendance marked.</p> : null}
                                    </div>
                                </article>
                            );
                        })}
                        {dashboard.courses.length === 0 ? <p className={styles.empty}>No courses mapped to this faculty yet.</p> : null}
                    </div>
                </section>
            ) : null}
        </main>
    );
}
