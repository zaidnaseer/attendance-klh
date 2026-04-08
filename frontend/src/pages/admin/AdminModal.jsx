import styles from './AdminModal.module.css';

export default function AdminModal({
  modalOpen,
  modalType,
  closeModal,
  handleSaveModal,
  facultyForm,
  setFacultyForm,
  studentForm,
  setStudentForm,
  courseForm,
  setCourseForm,
  facultyMapForm,
  setFacultyMapForm,
  studentMapForm,
  setStudentMapForm,
  overview,
}) {
  if (!modalOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={closeModal}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            {modalType === 'faculty' && 'Add Faculty Member'}
            {modalType === 'student' && 'Add Student'}
            {modalType === 'course' && 'Add Course'}
            {modalType === 'mapFaculty' && 'Assign Faculty to Course'}
            {modalType === 'mapStudent' && 'Enroll Student in Course'}
          </div>
          <button className={styles.closeBtn} type="button" onClick={closeModal}>
            x
          </button>
        </div>

        <div className={styles.modalBody}>
          {modalType === 'faculty' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="faculty-name">Full Name *</label>
                <input
                  id="faculty-name"
                  className={styles.formInput}
                  placeholder="Dr. Jane Smith"
                  value={facultyForm.name}
                  onChange={(event) =>
                    setFacultyForm({ ...facultyForm, name: event.target.value })
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="faculty-code">Faculty Code *</label>
                <input
                  id="faculty-code"
                  className={styles.formInput}
                  placeholder="FACULTY001"
                  value={facultyForm.code}
                  onChange={(event) =>
                    setFacultyForm({ ...facultyForm, code: event.target.value })
                  }
                />
              </div>
            </>
          )}

          {modalType === 'student' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="student-name">Full Name *</label>
                <input
                  id="student-name"
                  className={styles.formInput}
                  placeholder="Rahul Sharma"
                  value={studentForm.name}
                  onChange={(event) =>
                    setStudentForm({ ...studentForm, name: event.target.value })
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="student-code">Student Code *</label>
                <input
                  id="student-code"
                  className={styles.formInput}
                  placeholder="CS2024001"
                  value={studentForm.code}
                  onChange={(event) =>
                    setStudentForm({ ...studentForm, code: event.target.value })
                  }
                />
              </div>
            </>
          )}

          {modalType === 'course' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="course-name">Course Name *</label>
                <input
                  id="course-name"
                  className={styles.formInput}
                  placeholder="Data Structures"
                  value={courseForm.name}
                  onChange={(event) =>
                    setCourseForm({ ...courseForm, name: event.target.value })
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="course-code">Course Code *</label>
                <input
                  id="course-code"
                  className={styles.formInput}
                  placeholder="CS301"
                  value={courseForm.code}
                  onChange={(event) =>
                    setCourseForm({ ...courseForm, code: event.target.value })
                  }
                />
              </div>
            </>
          )}

          {modalType === 'mapFaculty' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="map-faculty-course">Select Course *</label>
                <select
                  id="map-faculty-course"
                  className={styles.formInput}
                  value={facultyMapForm.courseId}
                  onChange={(event) =>
                    setFacultyMapForm({ ...facultyMapForm, courseId: event.target.value })
                  }
                >
                  <option value="">-- choose course --</option>
                  {overview.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="map-faculty-member">Select Faculty *</label>
                <select
                  id="map-faculty-member"
                  className={styles.formInput}
                  value={facultyMapForm.facultyId}
                  onChange={(event) =>
                    setFacultyMapForm({ ...facultyMapForm, facultyId: event.target.value })
                  }
                >
                  <option value="">-- choose faculty --</option>
                  {overview.faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.faculty_code} - {faculty.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {modalType === 'mapStudent' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="map-student-course">Select Course *</label>
                <select
                  id="map-student-course"
                  className={styles.formInput}
                  value={studentMapForm.courseId}
                  onChange={(event) =>
                    setStudentMapForm({ ...studentMapForm, courseId: event.target.value })
                  }
                >
                  <option value="">-- choose course --</option>
                  {overview.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="map-student-member">Select Student *</label>
                <select
                  id="map-student-member"
                  className={styles.formInput}
                  value={studentMapForm.studentId}
                  onChange={(event) =>
                    setStudentMapForm({ ...studentMapForm, studentId: event.target.value })
                  }
                >
                  <option value="">-- choose student --</option>
                  {overview.students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.student_code} - {student.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnGhost} type="button" onClick={closeModal}>
            Cancel
          </button>
          <button className={styles.btnPrimary} type="button" onClick={handleSaveModal}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
