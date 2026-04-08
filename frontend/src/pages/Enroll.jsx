import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getStudent } from '../lib/api';
import CameraView from '../components/CameraView';
import Toast from '../components/Toast';
import styles from './Enroll.module.css';

export default function Enroll() {
  const { studentCode } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [toast, setToast] = useState(null);
  const [pageMessage, setPageMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadStudent() {
      try {
        const data = await getStudent(studentCode);
        if (mounted) {
          setStudent(data);
        }
      } catch (error) {
        if (!mounted) {
          return;
        }
        if (error.status === 404 && error.data?.code === 'STUDENT_NOT_FOUND') {
          setPageMessage('Student not found. Contact your admin.');
          setToast({ type: 'error', title: 'Student not found', message: 'Contact your admin.' });
        } else if (error.status === 409 && error.data?.code === 'ALREADY_ENROLLED') {
          setPageMessage('Already enrolled. Nothing to do.');
          setToast({ type: 'error', title: 'Already enrolled', message: 'Nothing else to do.' });
        } else {
          setPageMessage('Unable to load enrollment session right now.');
          setToast({ type: 'error', title: 'Load failed', message: error.message });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadStudent();
    return () => {
      mounted = false;
    };
  }, [studentCode]);

  if (loading) {
    return <main className={styles.page}><div className={styles.card}>Loading...</div></main>;
  }

  if (!student) {
    return (
      <main className={styles.page}>
        <Toast toast={toast} />
        <div className={styles.card}>
          <p style={{ marginBottom: '16px' }}>{pageMessage || 'Enrollment unavailable.'}</p>
          <Link to="/student" className={styles.actionBtn}>Go to Student Dashboard</Link>
        </div>
      </main>
    );
  }

  if (student.enrolled) {
    return (
      <main className={styles.page}>
        <Toast toast={toast} />
        <div className={styles.card}>
          <p style={{ marginBottom: '16px' }}>Already enrolled. Nothing to do.</p>
          <Link to="/student" className={styles.actionBtn}>Go to Student Dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Toast toast={toast} />
      <section className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className={styles.kicker}>Enrollment</p>
          <Link to="/student" className={styles.actionBtn}>Student Dashboard</Link>
        </div>
        <h1>{student.name}</h1>
        <p className={styles.copy}>Follow the on-screen poses to complete your enrollment.</p>
      </section>
      <CameraView 
        studentCode={studentCode} 
        studentName={student.name} 
        onSuccess={(result) => {
          setToast({ type: 'success', title: 'Success', message: result.code });
          setTimeout(() => navigate('/student'), 3000);
        }} 
      />
    </main>
  );
}
