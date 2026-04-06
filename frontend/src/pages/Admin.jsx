import { useEffect, useState } from 'react';
import { createStudent, deleteStudent, getStudents } from '../lib/api';
import Toast from '../components/Toast';
import styles from './Admin.module.css';

export default function Admin() {
  const [students, setStudents] = useState([]);
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [toast, setToast] = useState(null);

  async function loadStudents() {
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (error) {
      setToast({ type: 'error', title: 'Load failed', message: error.message });
    }
  }

  useEffect(() => {
    loadStudents();
    const interval = setInterval(loadStudents, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await createStudent({ name, studentCode });
      setName('');
      setStudentCode('');
      setToast({ type: 'success', title: 'Student registered', message: studentCode });
      loadStudents();
    } catch (error) {
      setToast({
        type: 'error',
        title: 'Registration failed',
        message: error.status === 409 ? 'Student code already exists' : error.message,
      });
    }
  }

  async function handleDelete(code) {
    try {
      await deleteStudent(code);
      setToast({ type: 'success', title: 'Student deleted', message: code });
      loadStudents();
    } catch (error) {
      setToast({ type: 'error', title: 'Delete failed', message: error.message });
    }
  }

  return (
    <main className={styles.page}>
      <Toast toast={toast} />
      <section className={styles.panel}>
        <h1>Admin</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Student name" className={styles.input} />
          <input value={studentCode} onChange={(event) => setStudentCode(event.target.value)} placeholder="Student code" className={styles.input} />
          <button className={styles.button} type="submit">Register student</button>
        </form>
      </section>

      <section className={styles.panel}>
        <h2>Students</h2>
        <div className={styles.table}>
          <div className={styles.headRow}>
            <span>Name</span>
            <span>Student Code</span>
            <span>Enrolled</span>
            <span />
          </div>
          {students.map((student) => (
            <div className={styles.row} key={student.id}>
              <span>{student.name}</span>
              <span>{student.student_code}</span>
              <span>
                <span className={`${styles.badge} ${student.enrolled ? styles.ready : styles.waiting}`}>
                  {student.enrolled ? 'Enrolled' : 'Pending'}
                </span>
              </span>
              <button className={styles.delete} type="button" onClick={() => handleDelete(student.student_code)}>Delete</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
