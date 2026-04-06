import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styles from './Landing.module.css';

export default function Landing() {
  const [studentCode, setStudentCode] = useState('');
  const navigate = useNavigate();

  function submit(event) {
    event.preventDefault();
    if (!studentCode.trim()) {
      return;
    }
    navigate(`/enroll/${encodeURIComponent(studentCode.trim())}`);
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>Facial Attendance</p>
        <h1>Start your enrollment session</h1>
        <p className={styles.copy}>Enter your student code to begin pose capture and liveness verification.</p>
        <form className={styles.form} onSubmit={submit}>
          <input
            className={styles.input}
            value={studentCode}
            onChange={(event) => setStudentCode(event.target.value)}
            placeholder="Student code"
            autoComplete="off"
          />
          <button className={styles.button} type="submit">Begin Enrollment</button>
        </form>
        <Link className={styles.link} to="/admin">Go to admin</Link>
      </section>
    </main>
  );
}
