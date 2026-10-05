import { useEffect, useRef } from 'react';
import styles from './Modal.module.css';

// Accessible dialog: Escape closes, focus moves in and is restored, Tab is trapped.
export default function Modal({ title, subtitle, onClose, children, footer }) {
    const ref = useRef(null);

    useEffect(() => {
        const previous = document.activeElement;
        const focusables = () => ref.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        (focusables()[0] || ref.current).focus();

        const onKey = (e) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Tab') {
                const items = focusables();
                if (!items.length) return;
                const first = items[0];
                const last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            if (previous && previous.focus) previous.focus();
        };
    }, [onClose]);

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div
                ref={ref}
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className={styles.title}>
                    {title}
                    {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
                </h3>
                <div className={styles.body}>{children}</div>
                {footer ? <div className={styles.footer}>{footer}</div> : null}
            </div>
        </div>
    );
}
