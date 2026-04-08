import styles from './AdminTable.module.css';

export default function CoursesTab({ overview, onAddCourse }) {
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
                      {mappedFaculty ? (
                        <span className={styles.badge}>{mappedFaculty.faculty_name}</span>
                      ) : (
                        <span className={styles.noValue}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles.badgeTeal}`}>
                        {mappedStudents.length} enrolled
                      </span>
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
