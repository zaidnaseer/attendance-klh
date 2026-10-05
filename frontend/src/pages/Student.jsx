import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import VerifyCameraView from '../components/VerifyCameraView';
import StudentGate1 from '../components/StudentGate1';
import StudentGPSGate from '../components/StudentGPSGate';
import { getStudentDashboard, markStudentAttendance } from '../lib/api';
import styles from './Student.module.css';

const GATE_LABELS = { gps: 'Verify location', qr: 'Scan code' };

// Presence checks the student must pass (in order) before face verification
function getGates(mode) {
    const gates = [];
    if (mode === 'gps' || mode === 'both') gates.push('gps');
    if (mode === 'qr' || mode === 'both') gates.push('qr');
    return gates;
}

function Stepper({ steps, current }) {
    return (
        <ol className={styles.stepper} aria-label="Progress">
            {steps.map((label, i) => (
                <li
                    key={label}
                    className={`${styles.step} ${i < current ? styles.stepDone : ''} ${i === current ? styles.stepActive : ''}`}
                    aria-current={i === current ? 'step' : undefined}
                >
                    <span className={styles.stepNum}>{i < current ? '✓' : i + 1}</span>
                    <span>{label}</span>
                </li>
            ))}
        </ol>
    );
}

export default function Student() {
    const navigate = useNavigate();
    const [studentCode, setStudentCode] = useState('');
    const [activeCode, setActiveCode] = useState('');
    const [dashboard, setDashboard] = useState(null);
    const [loginError, setLoginError] = useState('');
    const [verifyTarget, setVerifyTarget] = useState(null);
    const [gateIndex, setGateIndex] = useState(0);
    const [faceVerified, setFaceVerified] = useState(false);
    const [isMarking, setIsMarking] = useState(false);
    const [markError, setMarkError] = useState('');
    const [toast, setToast] = useState(null);
    const verifyRef = useRef(null);

    async function loadDashboard(code = activeCode, isInitial = false) {
        if (!code) return;
        try {
            const data = await getStudentDashboard(code);
            setDashboard(data);
        } catch (error) {
            if (isInitial) {
                setActiveCode('');
                setLoginError(error.status === 404 ? 'No student found with that ID.' : error.message);
            }
        }
    }

    // Keep the course list fresh so a newly started session shows up without a reload.
    useEffect(() => {
        if (!activeCode) return undefined;
        const interval = setInterval(() => loadDashboard(activeCode), 5000);
        return () => clearInterval(interval);
    }, [activeCode]);

    useEffect(() => {
        if (verifyTarget && verifyRef.current) {
            verifyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [verifyTarget]);

    // Close the flow if the teacher ends the session underneath the student.
    useEffect(() => {
        if (!verifyTarget || !dashboard) return;
        const course = dashboard.courses.find((c) => c.course_code === verifyTarget.courseCode);
        if (course && course.active_session_id !== verifyTarget.sessionId && !faceVerified) {
            setVerifyTarget(null);
            setToast({ type: 'error', title: 'Session ended', message: `${verifyTarget.courseCode} is no longer taking attendance.` });
        }
    }, [dashboard]);

    function submitCode(event) {
        event.preventDefault();
        const code = studentCode.trim();
        if (!code) return;
        setLoginError('');
        setActiveCode(code);
        loadDashboard(code, true);
    }

    function resetFlow() {
        setVerifyTarget(null);
        setGateIndex(0);
        setFaceVerified(false);
        setMarkError('');
    }

    function logout() {
        setDashboard(null);
        setActiveCode('');
        setStudentCode('');
        resetFlow();
        navigate('/');
    }

    async function markAttendance() {
        if (!verifyTarget || !activeCode) return;
        setIsMarking(true);
        setMarkError('');
        try {
            await markStudentAttendance(activeCode, verifyTarget.sessionId);
            setToast({ type: 'success', title: 'Attendance marked', message: `${verifyTarget.courseCode} recorded` });
            resetFlow();
            loadDashboard(activeCode);
        } catch (error) {
            setMarkError(error.message || 'Could not record attendance.');
        } finally {
            setIsMarking(false);
        }
    }

    function handleVerified() {
        setFaceVerified(true);
        markAttendance();
    }

    const gates = verifyTarget?.gates || [];
    const steps = [...gates.map((g) => GATE_LABELS[g]), 'Face check', 'Done'];
    const currentGate = gates[gateIndex];
    const currentStep = faceVerified ? gates.length + 1 : Math.min(gateIndex, gates.length);

    return (
        <main className={styles.page}>
            <Toast toast={toast} />
            <section className={styles.panel}>
                <div className={styles.headerRow}>
                    <h1>Student Dashboard</h1>
                    {dashboard && (
                        <button className={`${styles.button} ${styles.delete}`} type="button" onClick={logout}>
                            Sign out
                        </button>
                    )}
                </div>
                {!dashboard && (
                    <form className={styles.form} onSubmit={submitCode}>
                        <div>
                            <label className={styles.label} htmlFor="student-id">Student ID</label>
                            <input
                                id="student-id"
                                className={styles.input}
                                style={{ width: '100%' }}
                                autoComplete="off"
                                value={studentCode}
                                onChange={(event) => { setStudentCode(event.target.value); setLoginError(''); }}
                                placeholder="e.g. STU001"
                            />
                            {loginError ? <p className={styles.error} role="alert">{loginError}</p> : null}
                        </div>
                        <button className={styles.button} type="submit" style={{ alignSelf: 'flex-end' }}>Continue</button>
                    </form>
                )}
            </section>

            {dashboard ? (
                <section className={styles.panel}>
                    <h2>Hi, {dashboard.student.name}</h2>
                    <p className={styles.meta}>
                        {dashboard.student.student_code} · Not you? <button type="button" className={styles.linkText} onClick={logout}>Switch student</button>
                    </p>

                    {!dashboard.student.enrolled ? (
                        <div className={styles.notice}>
                            <p>You need to register your face once before you can mark attendance.</p>
                            <Link className={styles.linkButton} to={`/enroll/${encodeURIComponent(dashboard.student.student_code)}`}>
                                Start face enrollment
                            </Link>
                        </div>
                    ) : (
                        <div className={styles.courseList}>
                            {dashboard.courses.map((course) => {
                                const pct = course.total_sessions > 0
                                    ? Math.round((course.attended_sessions / course.total_sessions) * 100)
                                    : null;
                                return (
                                    <article className={styles.courseCard} key={course.id}>
                                        <div className={styles.courseInfo}>
                                            <h3>{course.course_code}</h3>
                                            <p>{course.name}</p>
                                            {pct !== null && (
                                                <div className={styles.history}>
                                                    <div className={styles.meter} role="img" aria-label={`${pct}% attendance`}>
                                                        <div
                                                            className={`${styles.meterFill} ${pct < 75 ? styles.meterLow : ''}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className={styles.meta}>
                                                        {pct}% · {course.attended_sessions}/{course.total_sessions} classes
                                                        {pct < 75 ? ' · below 75%' : ''}
                                                    </span>
                                                </div>
                                            )}
                                            {course.active_session_id && !course.is_present && (
                                                <p className={styles.meta}>
                                                    Requires: {getGates(course.active_session_verification_mode || 'qr')
                                                        .map((g) => (g === 'gps' ? 'Location' : 'QR code'))
                                                        .concat('Face check')
                                                        .join(' → ')}
                                                </p>
                                            )}
                                        </div>
                                        {course.active_session_id ? (
                                            course.is_present ? (
                                                <span className={styles.presentTag}>Present ✓</span>
                                            ) : (
                                                <button
                                                    className={styles.button}
                                                    type="button"
                                                    onClick={() => {
                                                        resetFlow();
                                                        setVerifyTarget({
                                                            sessionId: course.active_session_id,
                                                            courseCode: course.course_code,
                                                            courseName: course.name,
                                                            gates: getGates(course.active_session_verification_mode || 'qr'),
                                                        });
                                                    }}
                                                >
                                                    Mark attendance
                                                </button>
                                            )
                                        ) : (
                                            <span className={styles.inactiveTag}>No active session</span>
                                        )}
                                    </article>
                                );
                            })}
                            {dashboard.courses.length === 0 ? <p className={styles.empty}>No courses assigned to you yet.</p> : null}
                        </div>
                    )}
                </section>
            ) : null}

            {verifyTarget && dashboard ? (
                <section className={styles.panel} ref={verifyRef}>
                    <div className={styles.headerRow}>
                        <div>
                            <h2 style={{ margin: 0 }}>Mark attendance · {verifyTarget.courseCode}</h2>
                            <p className={styles.meta} style={{ margin: '4px 0 0' }}>{verifyTarget.courseName}</p>
                        </div>
                        <button type="button" className={styles.ghostBtn} onClick={resetFlow}>Cancel</button>
                    </div>

                    <Stepper steps={steps} current={currentStep} />

                    {currentGate === 'gps' ? (
                        <StudentGPSGate
                            key={`gps-${verifyTarget.sessionId}`}
                            sessionId={verifyTarget.sessionId}
                            studentId={dashboard.student.id}
                            onPass={() => setGateIndex((index) => index + 1)}
                        />
                    ) : currentGate === 'qr' ? (
                        <StudentGate1
                            key={`qr-${verifyTarget.sessionId}`}
                            sessionId={verifyTarget.sessionId}
                            studentId={dashboard.student.id}
                            onPass={() => setGateIndex((index) => index + 1)}
                        />
                    ) : !faceVerified ? (
                        <VerifyCameraView
                            studentCode={dashboard.student.student_code}
                            studentName={dashboard.student.name}
                            onVerified={handleVerified}
                        />
                    ) : (
                        <div className={styles.notice} role="status">
                            {markError ? (
                                <>
                                    <p className={styles.error} role="alert">
                                        Your face was verified, but we couldn't record attendance: {markError}
                                    </p>
                                    <button type="button" className={styles.button} onClick={markAttendance} disabled={isMarking}>
                                        {isMarking ? 'Saving…' : 'Retry saving attendance'}
                                    </button>
                                </>
                            ) : (
                                <p>Face verified. Saving your attendance…</p>
                            )}
                        </div>
                    )}
                </section>
            ) : null}
        </main>
    );
}
