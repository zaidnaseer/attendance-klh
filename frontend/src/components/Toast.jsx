import { useState, useEffect } from 'react';
import styles from './Toast.module.css';

export default function Toast({ toast }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!visible || !toast) {
    return null;
  }

  return (
    <div className={`${styles.toast} ${styles[toast.type]}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <div className={styles.title}>{toast.title}</div>
      {toast.message ? <div className={styles.message}>{toast.message}</div> : null}
    </div>
  );
}
