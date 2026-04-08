import styles from './AdminTable.module.css';

export default function FacultyTab({ overview, onAddFaculty, onDeleteFaculty }) {
    return (
        <>
            <div className={styles.sectionHeader}>
                <h2>Faculty Members</h2>
                <button className={styles.btnPrimary} type="button" onClick={onAddFaculty}>
                    Add Faculty
                </button>
            </div>

            <div className={styles.tableWrap}>
                {overview.faculties.length > 0 ? (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Code</th>
                                <th>Courses</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overview.faculties.map((faculty) => {
                                const courseCodes = overview.courseFaculties
                                    .filter((mapping) => mapping.faculty_id === faculty.id)
                                    .map((mapping) => mapping.course_code);

                                return (
                                    <tr key={faculty.id}>
                                        <td>{faculty.name}</td>
                                        <td>
                                            <code className={styles.code}>{faculty.faculty_code}</code>
                                        </td>
                                        <td>
                                            {courseCodes.length > 0 ? (
                                                courseCodes.map((courseCode) => (
                                                    <span key={courseCode} className={styles.badge}>
                                                        {courseCode}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className={styles.noValue}>None</span>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                className={styles.btnDanger}
                                                type="button"
                                                onClick={() => onDeleteFaculty(faculty.faculty_code)}
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
                    <div className={styles.emptyState}>No faculty members added yet</div>
                )}
            </div>
        </>
    );
}
