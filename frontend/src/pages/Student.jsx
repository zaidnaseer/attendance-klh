import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import VerifyCameraView from '../components/VerifyCameraView';
import StudentGate1 from '../components/StudentGate1';
import { getStudentDashboard, markStudentAttendance } from '../lib/api';        
import styles from './Student.module.css';

export default function Student() {
    const navigate = useNavigate();
    const [studentCode, setStudentCode] = useState('');
    const [activeCode, setActiveCode] = useState('');
    const [dashboard, setDashboard] = useState(null);
    const [verifyTarget, setVerifyTarget] = useState(null);
    const [gate1Passed, setGate1Passed] = useState(false);
    const [toast, setToast] = useState(null);

    async function loadDashboard(code = activeCode) {
        if (!code) {
            return;
        }
        try {
            const data = await getStudentDashboard(code);
            setDashboard(data);
        } catch (error) {
            setDashboard(null);
            setToast({ type: 'error', title: 'Load failed', message: error.message });
        }
    }

    function submitCode(event) {
        event.preventDefault();
        if (!studentCode.trim()) {
            return;
        }
        const code = studentCode.trim();
        setActiveCode(code);
        loadDashboard(code);
    }

    async function handleVerified() {
        if (!verifyTarget || !activeCode) {
            return;
        }
        try {
            await markStudentAttendance(activeCode, verifyTarget.sessionId);
            setToast({ type: 'success', title: 'Attendance marked', message: `${verifyTarget.courseCode} recorded` });
            setVerifyTarget(null);
            loadDashboard(activeCode);
        } catch (error) {
            setToast({ type: 'error', title: 'Attendance failed', message: error.message });
        }
    }

    return (
        <main className={styles.page}>
            <Toast toast={toast} />
            <section className={styles.panel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>Student Dashboard</h1>
                    {dashboard && (
                        <button 
                            className={`${styles.button} ${styles.delete}`} 
                            type="button" 
                            onClick={() => {
                                setDashboard(null);
                                setActiveCode('');
                                setStudentCode('');
                                setVerifyTarget(null);
                                navigate('/');
                            }}
                        >
                            Logout
                        </button>
                    )}
                </div>
                {!dashboard && (
                    <form className={styles.form} onSubmit={submitCode}>
                        <input
                            className={styles.input}
                            value={studentCode}
                            onChange={(event) => setStudentCode(event.target.value)}
                            placeholder="Enter student code"
                        />
                        <button className={styles.button} type="submit">Load</button>
                    </form>
                )}
            </section>

            {dashboard ? (
                <section className={styles.panel}>
                    <h2>{dashboard.student.name} ({dashboard.student.student_code})</h2>

                    {!dashboard.student.enrolled ? (
                        <div className={styles.notice}>
                            <p>Enrollment is required before attendance.</p>
                            <Link className={styles.linkButton} to={`/enroll/${encodeURIComponent(dashboard.student.student_code)}`}>
                                Start Enrollment
                            </Link>
                        </div>
                    ) : (
                        <div className={styles.courseList}>
                            {dashboard.courses.map((course) => (
                                <article className={styles.courseCard} key={course.id}>
                                    <div>
                                        <h3>{course.course_code}</h3>
                                        <p>{course.name}</p>
                                    </div>
                                    {course.active_session_id ? (
                                        course.is_present ? (
                                            <span className={styles.presentTag}>Present</span>
                                        ) : (
                                            <button
                                                className={styles.button}
                                                type="button"
                                                onClick={() => {
                                                    setGate1Passed(false);
                                                    setVerifyTarget({
                                                        sessionId: course.active_session_id,
                                                        courseCode: course.course_code,
                                                        courseName: course.name,    
                                                    });
                                                }}
                                            >
                                                Mark Attendance
                                            </button>
                                        )
                                    ) : (
                                        <span className={styles.inactiveTag}>No active session</span>
                                    )}
                                </article>
                            ))}
                            {dashboard.courses.length === 0 ? <p className={styles.empty}>No courses mapped yet.</p> : null}
                        </div>
                    )}
                </section>
            ) : null}

            {verifyTarget && dashboard ? (
                <section className={styles.panel}>
                    <h2>Verify for {verifyTarget.courseCode}</h2>
                    <p className={styles.meta}>{verifyTarget.courseName}</p>
                    
                    {!gate1Passed ? (
                        <StudentGate1 
                            sessionId={verifyTarget.sessionId} 
                            studentId={dashboard.student.id} 
                            onPass={() => setGate1Passed(true)} 
                        />
                    ) : (
                        <VerifyCameraView
                            studentCode={dashboard.student.student_code}
                            studentName={dashboard.student.name}
                            onVerified={handleVerified}
                        />
                    )}
                </section>
            ) : null}
        </main>
    );
}
