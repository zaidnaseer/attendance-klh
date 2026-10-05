import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
    facultyAddStudent,
    facultyRemoveStudent,
    getFacultyDashboard,
    startAttendanceSession,
    endAttendanceSession,
    setCourseVerificationMode,
    setStudentAttendance,
} from '../lib/api';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import ClassesHome from '../components/faculty/ClassesHome';
import ClassView from '../components/faculty/ClassView';
import { downloadCsv, VERIFICATION_OPTIONS } from '../components/faculty/utils';
import styles from './Faculty.module.css';

const TABS = ['live', 'roster', 'history', 'reports'];

// Location hash is "#<courseId>/<tab>"; an empty hash means the classes home.
function parseHash() {
    const [courseId, tab] = window.location.hash.replace(/^#/, '').split('/');
    return { courseId: courseId || null, tab: TABS.includes(tab) ? tab : 'live' };
}

export default function Faculty() {
    const [facultyCode, setFacultyCode] = useState('');
    const [activeCode, setActiveCode] = useState('');
    const [dashboard, setDashboard] = useState(null);
    const [toast, setToast] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [route, setRoute] = useState(parseHash);
    const [selectedPastSession, setSelectedPastSession] = useState(null);
    const [savingModeFor, setSavingModeFor] = useState(null);
    const [loginError, setLoginError] = useState('');
    const [confirm, setConfirm] = useState(null);
    const navigate = useNavigate();

    async function loadDashboard(code = activeCode, isInitial = false) {
        if (!code) {
            return;
        }
        if (isInitial) setIsLoading(true);
        try {
            const data = await getFacultyDashboard(code);
            setDashboard(data);
        } catch (error) {
            setDashboard(null);
            if (isInitial) {
                setActiveCode('');
                setLoginError(error.status === 404 ? 'No faculty found with that ID.' : error.message);
            } else {
                setToast({ type: 'error', title: 'Load failed', message: error.message });
            }
        } finally {
            if (isInitial) setIsLoading(false);
        }
    }

    useEffect(() => {
        const onPop = () => setRoute(parseHash());
        window.addEventListener('popstate', onPop);
        window.addEventListener('hashchange', onPop);
        return () => {
            window.removeEventListener('popstate', onPop);
            window.removeEventListener('hashchange', onPop);
        };
    }, []);

    function go(courseId, tab = 'live', replace = false) {
        const hash = courseId ? `#${courseId}/${tab}` : '';
        const url = window.location.pathname + window.location.search + hash;
        window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
        setRoute({ courseId: courseId || null, tab });
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
        setLoginError('');
        setActiveCode(code);
        // loadDashboard(code) will be triggered by useEffect when activeCode changes
    }

    async function addStudent(courseId, studentId) {
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
            await loadDashboard(activeCode);
            go(courseId, 'live');
        } catch (error) {
            setToast({ type: 'error', title: 'Start session failed', message: error.message });
        }
    }

    async function changeVerificationMode(courseId, mode) {
        if (!activeCode) {
            return;
        }
        setSavingModeFor(courseId);
        try {
            await setCourseVerificationMode(activeCode, courseId, mode);
            const label = VERIFICATION_OPTIONS.find((option) => option.value === mode)?.label;
            setToast({ type: 'success', title: 'Verification updated', message: `Students will verify using ${label}` });
            await loadDashboard(activeCode);
        } catch (error) {
            setToast({ type: 'error', title: 'Update failed', message: error.message });
        } finally {
            setSavingModeFor(null);
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

    async function toggleAttendance(course, student, present) {
        try {
            await setStudentAttendance(activeCode, course.id, course.activeSession.id, student.id, present);
            loadDashboard(activeCode);
        } catch (error) {
            setToast({ type: 'error', title: 'Update failed', message: error.message });
        }
    }

    function exportSessionCsv(course, session) {
        const presentIds = new Set(session.present_ids || []);
        downloadCsv(`${course.course_code}-${new Date(session.started_at).toISOString().slice(0, 10)}.csv`, [
            ['student_code', 'name', 'status'],
            ...course.students.map((st) => [st.student_code, st.name, presentIds.has(st.id) ? 'present' : 'absent']),
        ]);
    }

    const actions = {
        startSession,
        endSession,
        toggleAttendance,
        addStudent,
        removeStudent,
        confirm: setConfirm,
        changeVerificationMode,
        refresh: () => loadDashboard(activeCode),
    };

    const allStudents = useMemo(() => dashboard?.allStudents || [], [dashboard]);
    const currentCourse = dashboard?.courses.find((c) => c.id === route.courseId) || null;

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
                                go(null);
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
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <label className={styles.label} htmlFor="faculty-id">Faculty ID</label>
                            <input
                                id="faculty-id"
                                className={styles.input}
                                type="text"
                                autoComplete="off"
                                value={facultyCode}
                                onChange={(event) => { setFacultyCode(event.target.value); setLoginError(''); }}
                                placeholder="e.g. FAC001"
                                style={{ width: '100%' }}
                            />
                            {loginError ? <p className={styles.error} role="alert">{loginError}</p> : null}
                        </div>
                        <button className={styles.button} type="submit" style={{ alignSelf: 'flex-end' }}>Continue</button>
                    </form>
                )}
            </section>

            {dashboard ? (
                <section className={styles.panel} style={{ paddingTop: '16px' }}>
                    <p className={styles.meta} style={{ marginTop: 0 }}>{dashboard.faculty.name} ({dashboard.faculty.faculty_code})</p>
                    {isLoading ? (
                        <div className={styles.courseCardSkeleton}>
                            <div className={`${styles.skeleton} ${styles.titleLine}`}></div>
                            <div className={`${styles.skeleton} ${styles.listSkeleton}`}></div>
                        </div>
                    ) : currentCourse ? (
                        <ClassView
                            course={currentCourse}
                            courses={dashboard.courses}
                            allStudents={allStudents}
                            tab={route.tab}
                            onTab={(tab) => go(currentCourse.id, tab, true)}
                            onBack={() => go(null)}
                            onPick={(id) => go(id, route.tab)}
                            actions={actions}
                            institution={dashboard.institution}
                            savingMode={savingModeFor === currentCourse.id}
                            onOpenSession={setSelectedPastSession}
                        />
                    ) : (
                        <ClassesHome
                            courses={dashboard.courses}
                            onOpen={(id, tab) => go(id, tab || 'live')}
                            onStart={startSession}
                        />
                    )}
                </section>
            ) : null}

            {selectedPastSession && (() => {
                const presentIds = new Set(selectedPastSession.present_ids || []);
                const students = selectedPastSession.course.students;
                const present = students.filter((st) => presentIds.has(st.id));
                const absent = students.filter((st) => !presentIds.has(st.id));
                return (
                    <Modal
                        title="Session report"
                        subtitle={`${new Date(selectedPastSession.started_at).toLocaleString()} · ${present.length} present, ${absent.length} absent`}
                        onClose={() => setSelectedPastSession(null)}
                        footer={(
                            <>
                                <button className={styles.button} type="button" onClick={() => exportSessionCsv(selectedPastSession.course, selectedPastSession)}>
                                    Export CSV
                                </button>
                                <button className={styles.smallBtn} type="button" onClick={() => setSelectedPastSession(null)}>Close</button>
                            </>
                        )}
                    >
                        {absent.map((st) => (
                            <div key={st.id} className={`${styles.reportRow} ${styles.reportAbsent}`}>
                                <span>{st.student_code} - {st.name}</span><span>Absent</span>
                            </div>
                        ))}
                        {present.map((st) => (
                            <div key={st.id} className={`${styles.reportRow} ${styles.reportPresent}`}>
                                <span>{st.student_code} - {st.name}</span><span>Present</span>
                            </div>
                        ))}
                    </Modal>
                );
            })()}

            {confirm && (
                <Modal
                    title={confirm.title}
                    onClose={() => setConfirm(null)}
                    footer={(
                        <>
                            <button className={styles.smallBtn} type="button" onClick={() => setConfirm(null)}>Cancel</button>
                            <button
                                className={`${styles.button} ${styles.endSessionBtn}`}
                                type="button"
                                onClick={() => { const fn = confirm.onConfirm; setConfirm(null); fn(); }}
                            >
                                {confirm.confirmLabel}
                            </button>
                        </>
                    )}
                >
                    <p style={{ margin: 0 }}>{confirm.message}</p>
                </Modal>
            )}
        </main>
    );
}
