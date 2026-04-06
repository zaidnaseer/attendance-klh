import styles from './Toast.module.css';

export default function Toast({ toast }) {
  if (!toast) {
    return null;
  }

  return (
    <div className={`${styles.toast} ${styles[toast.type]}`}>
      <div className={styles.title}>{toast.title}</div>
      {toast.message ? <div className={styles.message}>{toast.message}</div> : null}
    </div>
  );
}
