import styles from './MappingsTab.module.css';

export default function MappingsTab({
  overview,
  onAssignFaculty,
  onEnrollStudent,
  onRemoveFacultyMapping,
  onRemoveStudentMapping,
}) {
  return (
    <div className={styles.mappingGrid}>
      <div className={styles.mappingCard}>
        <div className={styles.mappingCardTitle}>Faculty to Course</div>
        <button className={styles.btnTeal} type="button" onClick={onAssignFaculty}>
          Assign Faculty
        </button>

        <div className={styles.mappingList}>
          {overview.courseFaculties.length > 0 ? (
            overview.courseFaculties.map((mapping) => (
              <div className={styles.mappingItem} key={mapping.id}>
                <div className={styles.mappingItemTitle}>
                  {mapping.course_code} - {mapping.course_name}
                </div>
                <div className={styles.mappingItemSub}>
                  Faculty: <strong>{mapping.faculty_name}</strong>
                </div>
                <button
                  className={styles.btnSmall}
                  type="button"
                  onClick={() => onRemoveFacultyMapping(mapping.id)}
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className={styles.noMapping}>No assignments yet</div>
          )}
        </div>
      </div>

      <div className={styles.mappingCard}>
        <div className={styles.mappingCardTitle}>Students to Course</div>
        <button className={styles.btnTeal} type="button" onClick={onEnrollStudent}>
          Enroll Student
        </button>

        <div className={styles.mappingList}>
          {overview.courseStudents.length > 0 ? (
            overview.courseStudents.map((mapping) => (
              <div className={styles.mappingItem} key={mapping.id}>
                <div className={styles.mappingItemTitle}>
                  {mapping.course_code} - {mapping.course_name}
                </div>
                <div className={styles.mappingItemSub}>
                  Student: <strong>{mapping.student_name}</strong>
                </div>
                <button
                  className={styles.btnSmall}
                  type="button"
                  onClick={() => onRemoveStudentMapping(mapping.id)}
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className={styles.noMapping}>No enrollments yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
