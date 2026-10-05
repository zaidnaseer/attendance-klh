import { useMemo, useState } from 'react';
import FacultyQRPanel from '../FacultyQRPanel';
import FacultyGPSPanel from '../FacultyGPSPanel';
import { VERIFICATION_OPTIONS, usesQr, usesGps } from './utils';
import styles from './Faculty.parts.module.css';

function VerificationPicker({ course, actions, institution, locked, saving }) {
    const mode = course.activeSession?.verification_mode || course.verification_mode || 'qr';
    const gpsConfigured = !!institution;
    return (
        <>
            <div className={styles.verifyRow}>
                <span className={styles.verifyLabel}>Student verification</span>
                <div className={styles.segmented} role="radiogroup" aria-label="Student verification method">
                    {VERIFICATION_OPTIONS.map((option) => {
                        const needsGps = usesGps(option.value) && !gpsConfigured;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={mode === option.value}
                                className={`${styles.segment} ${mode === option.value ? styles.segmentActive : ''}`}
                                disabled={locked || saving || needsGps}
                                title={needsGps ? 'The admin has not set the institution location yet' : undefined}
                                onClick={() => option.value !== mode && actions.changeVerificationMode(course.id, option.value)}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            {locked ? (
                <p className={styles.verifyHint}>Locked while a session is active. End the session to change it.</p>
            ) : !gpsConfigured ? (
                <p className={styles.verifyHint}>GPS options are unavailable until the admin sets the institution location.</p>
            ) : null}
        </>
    );
}

export default function LiveTab({ course, actions, institution, savingMode }) {
    const [showPresent, setShowPresent] = useState(false);
    const [search, setSearch] = useState('');
    const session = course.activeSession;

    const { present, pending } = useMemo(() => {
        const ids = new Set((course.attendance || []).map((a) => a.student_id));
        return {
            present: course.students.filter((s) => ids.has(s.id)),
            pending: course.students.filter((s) => !ids.has(s.id)),
        };
    }, [course]);

    if (!session) {
        return (
            <div className={styles.empty}>
                <p style={{ fontSize: '1.1rem', color: 'var(--text)', marginTop: 0 }}>No active session</p>
                <p>Choose how students verify, then start a session to let them mark attendance.</p>
                <VerificationPicker course={course} actions={actions} institution={institution} locked={false} saving={savingMode} />
                <button type="button" className={styles.btn} onClick={() => actions.startSession(course.id)} disabled={course.students.length === 0}>
                    Start session
                </button>
                {course.students.length === 0 && <p>Add students in the Roster tab first.</p>}
            </div>
        );
    }

    const q = search.trim().toLowerCase();
    const matches = (s) => !q || `${s.student_code} ${s.name}`.toLowerCase().includes(q);
    const started = new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={styles.stack}>
            <div className={styles.row2}>
                <span className={styles.live}><span className={styles.liveDot} />Session live · started {started} · {VERIFICATION_OPTIONS.find((o) => o.value === session.verification_mode)?.label || 'QR Code'}</span>
                <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger}`}
                    onClick={() => actions.confirm({
                        title: 'End this session?',
                        message: 'Students will no longer be able to mark attendance for this class.',
                        confirmLabel: 'End session',
                        onConfirm: () => actions.endSession(course.id),
                    })}
                >
                    End session
                </button>
            </div>

            <VerificationPicker course={course} actions={actions} institution={institution} locked saving={savingMode} />

            {usesGps(session.verification_mode) && (
                <FacultyGPSPanel
                    sessionId={session.id}
                    institution={institution}
                    presentCount={present.length}
                    totalCount={course.students.length}
                    onAttendanceMarked={usesQr(session.verification_mode) ? undefined : actions.refresh}
                />
            )}
            {usesQr(session.verification_mode) && (
                <FacultyQRPanel
                    sessionId={session.id}
                    isActive
                    presentCount={present.length}
                    totalCount={course.students.length}
                    onAttendanceMarked={actions.refresh}
                />
            )}

            <div className={styles.summary} role="status">
                <span className={styles.summaryBig}>{present.length} / {course.students.length} present</span>
                <span className={styles.muted}>{pending.length} not yet marked</span>
            </div>

            <div className={styles.row2}>
                <h4 style={{ margin: 0 }}>Not yet marked ({pending.length})</h4>
                <input
                    className={styles.input}
                    type="search"
                    aria-label="Search students"
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className={styles.list}>
                {pending.filter(matches).map((s) => (
                    <div className={styles.item} key={s.id}>
                        <span className={styles.itemMain}>
                            <span className={styles.itemName}>{s.name}</span>
                            <span className={styles.itemSub}>{s.student_code}{!s.enrolled ? ' · face not enrolled' : ''}</span>
                        </span>
                        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => actions.toggleAttendance(course, s, true)}>
                            Mark present
                        </button>
                    </div>
                ))}
                {pending.length === 0 && <p className={styles.empty}>Everyone is marked present 🎉</p>}
                {pending.length > 0 && pending.filter(matches).length === 0 && <p className={styles.empty}>No matches</p>}
            </div>

            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} aria-expanded={showPresent} onClick={() => setShowPresent((v) => !v)}>
                {showPresent ? '▾' : '▸'} Present ({present.length})
            </button>
            {showPresent && (
                <div className={styles.list}>
                    {present.filter(matches).map((s) => (
                        <div className={styles.item} key={s.id}>
                            <span className={styles.itemMain}>
                                <span className={styles.itemName}>{s.name}</span>
                                <span className={styles.itemSub}>{s.student_code}</span>
                            </span>
                            <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => actions.toggleAttendance(course, s, false)}>
                                Mark absent
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
