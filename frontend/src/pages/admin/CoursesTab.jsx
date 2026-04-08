import { useState, useRef, useEffect } from 'react';
import styles from './AdminTable.module.css';

function InlineFacultySelect({ courseId, mappedFaculty, allFaculty, onMapFaculty }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (facultyId) => {
        if (!mappedFaculty || mappedFaculty.faculty_id !== facultyId) {
            onMapFaculty(courseId, facultyId, mappedFaculty?.id);
        }
        setIsOpen(false);
        setSearch('');
    };

    const filteredFaculty = allFaculty.filter(f => 
        f.name.toLowerCase().includes(search.toLowerCase()) || 
        f.employee_id.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
            <div 
                onClick={() => setIsOpen(!isOpen)} 
                style={{ 
                    cursor: 'pointer', 
                    padding: '8px 4px', 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                {mappedFaculty ? (
                    <span className={styles.badge}>{mappedFaculty.faculty_name}</span>
                ) : (
                    <span className={styles.noValue}>Unassigned</span>
                )}
                <span style={{ fontSize: '10px', opacity: 0.6, color: '#94a3b8' }}>▼</span>
            </div>
            
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    minWidth: '220px',
                    zIndex: 50,
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    marginTop: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    maxHeight: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    color: '#e2e8f0'
                }}>
                    <input 
                        type="text" 
                        placeholder="Search faculty..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            margin: '10px',
                            padding: '8px 12px',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            borderRadius: '6px',
                            width: 'calc(100% - 20px)',
                            boxSizing: 'border-box',
                            background: 'rgba(2, 6, 23, 0.6)',
                            color: '#f8fafc',
                            outline: 'none',
                            fontSize: '14px'
                        }}
                        autoFocus
                    />
                    <div style={{ overflowY: 'auto' }}>
                        <div 
                            onClick={() => handleSelect(null)}
                            style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                                backgroundColor: !mappedFaculty ? 'rgba(15, 23, 42, 0.8)' : 'transparent',
                                color: '#f87171',
                                transition: 'background-color 0.2s',
                                fontSize: '14px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = !mappedFaculty ? 'rgba(15, 23, 42, 0.8)' : 'transparent'}
                        >
                            <em>Remove Assignment</em>
                        </div>
                        {filteredFaculty.map(faculty => (
                            <div 
                                key={faculty.id}
                                onClick={() => handleSelect(faculty.id)}
                                style={{
                                    padding: '10px 14px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                                    backgroundColor: mappedFaculty?.faculty_id === faculty.id ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = mappedFaculty?.faculty_id === faculty.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = mappedFaculty?.faculty_id === faculty.id ? 'rgba(56, 189, 248, 0.1)' : 'transparent'}
                            >
                                <div style={{ fontWeight: '500', fontSize: '15px' }}>{faculty.name}</div>
                                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>{faculty.employee_id}</div>
                            </div>
                        ))}
                        {filteredFaculty.length === 0 && (
                            <div style={{ padding: '8px 12px', color: '#888', textAlign: 'center' }}>
                                No results found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CoursesTab({ overview, onAddCourse, onDeleteCourse, onMapFaculty }) {
    return (
        <>
            <div className={styles.sectionHeader}>
                <h2>Courses</h2>
                <button className={styles.btnPrimary} type="button" onClick={onAddCourse}>
                    Add Course
                </button>
            </div>

            <div className={styles.tableWrap}>
                {overview.courses.length > 0 ? (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Code</th>
                                <th>Faculty</th>
                                <th>Students</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overview.courses.map((course) => {
                                const mappedFaculty = overview.courseFaculties.find(
                                    (mapping) => mapping.course_id === course.id,
                                );
                                const mappedStudents = overview.courseStudents.filter(
                                    (mapping) => mapping.course_id === course.id,
                                );

                                return (
                                    <tr key={course.id}>
                                        <td>{course.name}</td>
                                        <td>
                                            <code className={styles.code}>{course.course_code}</code>
                                        </td>
                                        <td>
                                            <InlineFacultySelect
                                                courseId={course.id}
                                                mappedFaculty={mappedFaculty}
                                                allFaculty={overview.faculties}
                                                onMapFaculty={onMapFaculty}
                                            />
                                        </td>
                                        <td>
                                            <span className={`${styles.badge} ${styles.badgeTeal}`}>
                                                {mappedStudents.length} enrolled
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className={styles.btnDanger}
                                                type="button"
                                                onClick={() => onDeleteCourse(course.course_code)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className={styles.emptyState}>No courses added yet</div>
                )}
            </div>
        </>
    );
}
