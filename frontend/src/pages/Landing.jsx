import { Link } from 'react-router-dom';
import styles from './Landing.module.css';

export default function Landing() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>Facial Attendance</p>
        <h1>Select a dashboard</h1>
        <p className={styles.copy}>
          No authentication is required for now. Choose the role dashboard to continue.
        </p>
        <div className={styles.dashboardGrid}>
          <Link className={styles.dashboardLink} to="/admin">
            <strong>Admin Dashboard</strong>
            <span>Manage courses, faculties, and student mapping.</span>
          </Link>
          <Link className={styles.dashboardLink} to="/faculty">
            <strong>Faculty Dashboard</strong>
            <span>Manage roster and start attendance sessions.</span>
          </Link>
          <Link className={styles.dashboardLink} to="/student">
            <strong>Student Dashboard</strong>
            <span>Enroll and mark attendance for active sessions.</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
