import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Faculty.parts.module.css';
import { courseTitle, groupBySubject } from './utils';

export default function ClassPicker({ courses, current, onSelect }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const listRef = useRef(null);
    const btnRef = useRef(null);

    const groups = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = q ? courses.filter((c) => `${c.name} ${c.course_code} ${c.section || ''}`.toLowerCase().includes(q)) : courses;
        return groupBySubject(list);
    }, [courses, search]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                btnRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    function close() {
        setOpen(false);
        setSearch('');
    }

    function onListKey(e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const items = [...listRef.current.querySelectorAll('button')];
        const i = items.indexOf(document.activeElement);
        e.preventDefault();
        const next = e.key === 'ArrowDown' ? items[Math.min(items.length - 1, i + 1)] : items[Math.max(0, i - 1)];
        next?.focus();
    }

    return (
        <div className={styles.pickerWrap}>
            <button
                ref={btnRef}
                type="button"
                className={styles.pickerBtn}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                {courseTitle(current)} <span aria-hidden="true">▾</span>
            </button>

            {open && (
                <>
                    <div className={styles.pickerBackdrop} onClick={close} />
                    <div className={styles.picker} role="dialog" aria-label="Switch class">
                        <input
                            autoFocus
                            className={styles.input}
                            type="search"
                            placeholder="Search classes"
                            aria-label="Search classes"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'ArrowDown' && (e.preventDefault(), listRef.current.querySelector('button')?.focus())}
                        />
                        <div className={styles.pickerList} ref={listRef} onKeyDown={onListKey} role="listbox">
                            {groups.length === 0 && <p className={styles.empty}>No matches</p>}
                            {groups.map((g) => (
                                <div key={g.subject}>
                                    <div className={styles.pickerGroup}>{g.subject}</div>
                                    {g.items.map((c) => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            role="option"
                                            aria-selected={c.id === current.id}
                                            className={`${styles.pickerItem} ${c.id === current.id ? styles.pickerItemActive : ''}`}
                                            onClick={() => { onSelect(c.id); close(); }}
                                        >
                                            <span>{courseTitle(c)}</span>
                                            {c.activeSession && <span className={styles.live}><span className={styles.liveDot} />LIVE</span>}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
