import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
    facultyAddStudent,
    facultyRemoveStudent,
    getFacultyDashboard,
    startAttendanceSession,
    endAttendanceSession,
} from '../lib/api';
import Toast from '../components/Toast';
import FacultyQRPanel from '../components/FacultyQRPanel';
import styles from './Faculty.module.css';

export default function Faculty() {
    const [facultyCode, setFacultyCode] = useState('');
    const [activeCode, setActiveCode] = useState('');
    const [dashboard, setDashboard] = useState(null);
    const [selectedByCourse, setSelectedByCourse] = useState({});
    const [toast, setToast] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeCourseId, setActiveCourseId] = useState(null);
    const [isEditingRoster, setIsEditingRoster] = useState(false);
    const [selectedPastSession, setSelectedPastSession] = useState(null);
    const navigate = useNavigate();

    async function loadDashboard(code = activeCode, isInitial = false) {
        if (!code) {
            return;
        }
        if (isInitial) setIsLoading(true);
        try {
            const data = await getFacultyDashboard(code);
            setDashboard(data);
            if (isInitial && data.courses && data.courses.length > 0) {
                setActiveCourseId(data.courses[0].id);
            }
        } catch (error) {
            setDashboard(null);
            setToast({ type: 'error', title: 'Load failed', message: error.message });
        } finally {
            if (isInitial) setIsLoading(false);
        }
    }

    useEffect(() => {
        if (!activeCode) {
            return undefined;
        }
        loadDashboard(activeCode, true);
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
        // loadDashboard(code) will be triggered by useEffect when activeCode changes
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

    async function endSession(courseId) {
        if (!activeCode) {
            return;
        }
        try {
            await endAttendanceSession(activeCode, courseId);
            setToast({ type: 'success', title: 'Session ended', message: 'Attendance session successfully closed' });
            loadDashboard(activeCode);
        } catch (error) {
            setToast({ type: 'error', title: 'End session failed', message: error.message });
        }
    }

    const allStudents = useMemo(() => dashboard?.allStudents || [], [dashboard]);

    return (
        <main className={styles.page}>
            <Toast toast={toast} />
            <section className={styles.panel} style={{ padding: dashboard ? '16px 24px' : '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: dashboard ? '0' : '14px' }}>
                    <h1 style={{ margin: 0 }}>Faculty Dashboard</h1>
                    {dashboard && (
                        <button
                            className={`${styles.button} ${styles.delete}`}     
                            type="button"
                            onClick={() => {
                                setDashboard(null);
                                setActiveCode('');
                                setFacultyCode('');
                                navigate('/');
                            }}
                            style={{ padding: '8px 16px' }}
                        >
                            Logout
                        </button>
                    )}
                </div>
                {!dashboard && (
                    <form className={styles.form} onSubmit={submitCode}>
                        <input
                            className={styles.input}
                            type="password"
                            value={facultyCode}
                            onChange={(event) => setFacultyCode(event.target.value)}
                            placeholder="Enter faculty code"
                        />
                        <button className={styles.button} type="submit">Load</button>
                    </form>
                )}
            </section>

            {dashboard ? (
                <section className={styles.panel} style={{ paddingTop: '16px' }}>
                    <h2 style={{ marginTop: 0, marginBottom: '16px' }}>{dashboard.faculty.name} ({dashboard.faculty.faculty_code})</h2>
                    <div className={styles.courseGrid} style={{ marginTop: 0 }}>
                        {isLoading ? (
                            <>
                                <div className={styles.tabs}>
                                    <div className={`${styles.skeleton} ${styles.tabBtnSkeleton}`}></div>
                                    <div className={`${styles.skeleton} ${styles.tabBtnSkeleton}`}></div>
                                    <div className={`${styles.skeleton} ${styles.tabBtnSkeleton}`}></div>
                                </div>
                                <div className={styles.courseCardSkeleton}>
                                    <div className={`${styles.skeleton} ${styles.titleLine}`}></div>
                                    <div className={`${styles.skeleton} ${styles.qrSkeleton}`}></div>
                                    <div className={`${styles.skeleton} ${styles.listSkeleton}`}></div>
                                </div>
                            </>
                        ) : dashboard.courses.length === 0 ? (
                            <p className={styles.empty}>No courses available.</p>
                        ) : (
                            <>
                                <div className={styles.tabs}>
                                    {dashboard.courses.map((c) => (
                                        <button 
                                            key={c.id} 
                                            onClick={() => {
                                                setActiveCourseId(c.id);
                                                setIsEditingRoster(false);
                                                setSelectedPastSession(null);
                                            }} 
                                            className={`${styles.tabBtn} ${activeCourseId === c.id ? styles.activeTab : ''}`}
                                        >
                                            {c.course_code} - {c.name}
                                        </button>
                                    ))}
                                </div>
                                {dashboard.courses.filter(course => course.id === activeCourseId).map((course) => {
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
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                className={styles.button}
                                                style={{ 
                                                    background: isEditingRoster ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                                                    color: '#38bdf8',
                                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                                    transition: 'all 0.2s',
                                                    opacity: course.activeSession ? 0.5 : 1,
                                                    cursor: course.activeSession ? 'not-allowed' : 'pointer'
                                                }}
                                                type="button"
                                                onClick={() => setIsEditingRoster(!isEditingRoster)}
                                                disabled={!!course.activeSession}
                                            >
                                                {isEditingRoster ? 'Save' : 'Edit'}
                                            </button>
                                            {course.activeSession ? (
                                                <button 
                                                    className={`${styles.button} ${styles.endSessionBtn}`} 
                                                    type="button" 
                                                    onClick={() => endSession(course.id)}
                                                    disabled={isEditingRoster}
                                                    style={{ opacity: isEditingRoster ? 0.5 : 1, cursor: isEditingRoster ? 'not-allowed' : 'pointer' }}
                                                >
                                                    End Session
                                                </button>
                                            ) : (
                                                <button 
                                                    className={styles.button} 
                                                    type="button" 
                                                    onClick={() => startSession(course.id)}
                                                    disabled={isEditingRoster}
                                                    style={{ opacity: isEditingRoster ? 0.5 : 1, cursor: isEditingRoster ? 'not-allowed' : 'pointer' }}
                                                >
                                                    Start Session
                                                </button>
                                            )}
                                        </div>
                                    </header>

                                    <p className={styles.meta}>
                                        {course.activeSession ? `Active session started at ${new Date(course.activeSession.started_at).toLocaleString()}` : 'No active session'}
                                    </p>
                                      {course.activeSession && (
                                          <FacultyQRPanel 
                                              sessionId={course.activeSession.id} 
                                              isActive={true} 
                                              onAttendanceMarked={() => loadDashboard(activeCode)}
                                          />
                                      )}
                                        {isEditingRoster && (
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
                                        )}

                                    <h4>Roster & Attendance</h4>
                                    <div className={styles.list}>
                                        {course.students.map((student) => {
                                            const isPresent = course.attendance && course.attendance.some(
                                                a => a.student_code === student.student_code
                                            );
                                            
                                            return (
                                                <div className={styles.row} key={student.id}>
                                                    <span>{student.student_code} - {student.name}</span>
                                                </div>
                                            );
                                        })}
                                        {course.students.length === 0 ? <p className={styles.empty}>No students enrolled.</p> : null}
                                    </div>


                                    {course.pastSessions && course.pastSessions.length > 0 && (
                                        <>
                                            <h4>Past Sessions</h4>
                                            <div className={styles.list}>
                                                {course.pastSessions.map((session) => (
                                                    <div 
                                                        className={styles.row} 
                                                        key={session.id}
                                                        onClick={() => setSelectedPastSession({ ...session, courseStudents: course.students })}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <span>{new Date(session.started_at).toLocaleString()}</span>
                                                        <span className={styles.countTag}>{session.present_count} / {course.students.length} present</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </article>
                            );
                        })}
                            </>
                        )}
                    </div>
                </section>
            ) : null}

            {selectedPastSession && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.75)',
                        zIndex: 1000,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                    onClick={() => setSelectedPastSession(null)}
                >
                    <div 
                        style={{
                            background: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '16px',
                            padding: '24px',
                            width: '400px',
                            maxWidth: '90%',
                            maxHeight: '80vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 16px 0', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
                            Absent Students
                            <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 'normal', marginTop: '4px' }}>
                                {new Date(selectedPastSession.started_at).toLocaleString()}
                            </div>
                        </h3>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {selectedPastSession.courseStudents
                                .filter(s => !(selectedPastSession.present_ids || []).includes(s.id))
                                .map(absentStudent => (
                                    <div 
                                        key={absentStudent.id} 
                                        style={{
                                            padding: '10px 12px',
                                            marginBottom: '8px',
                                            borderRadius: '8px',
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: '#fecaca',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <span>{absentStudent.student_code} - {absentStudent.name}</span>
                                        <span style={{ fontSize: '12px', opacity: 0.8 }}>Absent</span>
                                    </div>
                                ))}
                            {selectedPastSession.courseStudents.filter(s => !(selectedPastSession.present_ids || []).includes(s.id)).length === 0 && (
                                <div style={{ textAlign: 'center', color: '#22c55e', padding: '20px' }}>
                                    Perfect Attendance! Everyone was present.
                                </div>
                            )}
                        </div>
<button 
                            className={styles.button} 
                            style={{ background: '#334155', color: '#f8fafc', marginTop: '16px', border: '1px solid #475569' }} 
                            onClick={() => setSelectedPastSession(null)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
