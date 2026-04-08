import styles from './AdminTable.module.css';

export default function StudentsTab({ overview, onAddStudent, onDeleteStudent }) {
  return (
    <>
      <div className={styles.sectionHeader}>
        <h2>Students</h2>
        <button className={styles.btnPrimary} type="button" onClick={onAddStudent}>
          Add Student
        </button>
      </div>

      <div className={styles.tableWrap}>
        {overview.students.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {overview.students.map((student) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>
                    <code className={styles.code}>{student.student_code}</code>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        student.enrolled ? styles.badgeGreen : styles.badgeGray
                      }`}
                    >
                      {student.enrolled ? 'Enrolled' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={styles.btnDanger}
                      type="button"
                      onClick={() => onDeleteStudent(student.student_code)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.emptyState}>No students added yet</div>
        )}
      </div>
    </>
  );
}
