import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getStudent } from '../lib/api';
import VerifyCameraView from '../components/VerifyCameraView';
import styles from './Enroll.module.css';

export default function Verify() {
    const { studentCode } = useParams();
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        let mounted = true;

        async function loadStudent() {
            try {
                const data = await getStudent(studentCode);
                if (!mounted) {
                    return;
                }
                setStudent(data);
                if (!data.enrolled) {
                    setMessage('Student is not enrolled yet. Complete enrollment first.');
                }
            } catch (error) {
                if (!mounted) {
                    return;
                }
                if (error.status === 404) {
                    setMessage('Student not found.');
                } else {
                    setMessage('Unable to load verification session.');
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

    if (!student || !student.enrolled) {
        return <main className={styles.page}><div className={styles.card}>{message || 'Verification unavailable.'}</div></main>;
    }

    return (
        <main className={styles.page}>
            <section className={styles.header}>
                <p className={styles.kicker}>Verification</p>
                <h1>{student.name}</h1>
                <p className={styles.copy}>Capture a face image to verify identity with anti-spoofing checks.</p>
            </section>
            <VerifyCameraView studentCode={studentCode} studentName={student.name} />
        </main>
    );
}
