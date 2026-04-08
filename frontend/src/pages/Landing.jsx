import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styles from './Landing.module.css';

export default function Landing() {
  const [studentCode, setStudentCode] = useState('');
  const [mode, setMode] = useState('enroll');
  const navigate = useNavigate();

  function submit(event) {
    event.preventDefault();
    if (!studentCode.trim()) {
      return;
    }
    navigate(`/${mode}/${encodeURIComponent(studentCode.trim())}`);
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>Facial Attendance</p>
        <h1>{mode === 'enroll' ? 'Start your enrollment session' : 'Start your verification session'}</h1>
        <p className={styles.copy}>
          {mode === 'enroll'
            ? 'Enter your student code to begin pose capture and liveness verification.'
            : 'Enter your student code to verify your identity after enrollment.'}
        </p>
        <div className={styles.modeSwitch}>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === 'enroll' ? styles.modeButtonActive : ''}`}
            onClick={() => setMode('enroll')}
          >
            Enroll
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === 'verify' ? styles.modeButtonActive : ''}`}
            onClick={() => setMode('verify')}
          >
            Verify
          </button>
        </div>
        <form className={styles.form} onSubmit={submit}>
          <input
            className={styles.input}
            value={studentCode}
            onChange={(event) => setStudentCode(event.target.value)}
            placeholder="Student code"
            autoComplete="off"
          />
          <button className={styles.button} type="submit">{mode === 'enroll' ? 'Begin Enrollment' : 'Begin Verification'}</button>
        </form>
        <Link className={styles.link} to="/admin">Go to admin</Link>
      </section>
    </main>
  );
}
