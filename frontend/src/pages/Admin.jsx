import { useEffect, useState } from 'react';
import {
  createCourse,
  createFaculty,
  createStudent,
  deleteStudent,
  getAdminOverview,
  mapFacultyToCourse,
  mapStudentToCourse,
  unmapFacultyCourse,
  unmapStudentCourse,
} from '../lib/api';
import Toast from '../components/Toast';
import styles from './Admin.module.css';

export default function Admin() {
  const [overview, setOverview] = useState({
    faculties: [],
    courses: [],
    students: [],
    courseFaculties: [],
    courseStudents: [],
  });

  const [facultyName, setFacultyName] = useState('');
  const [facultyCode, setFacultyCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [name, setName] = useState('');
  const [studentCode, setStudentCode] = useState('');

  const [selectedCourseForFaculty, setSelectedCourseForFaculty] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedCourseForStudent, setSelectedCourseForStudent] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  const [toast, setToast] = useState(null);

  async function loadOverview() {
    try {
      const data = await getAdminOverview();
      setOverview(data);
    } catch (error) {
      setToast({ type: 'error', title: 'Load failed', message: error.message });
    }
  }

  useEffect(() => {
    loadOverview();
    const interval = setInterval(loadOverview, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleFacultySubmit(event) {
    event.preventDefault();
    try {
      await createFaculty({ name: facultyName, facultyCode });
      setFacultyName('');
      setFacultyCode('');
      setToast({ type: 'success', title: 'Faculty added', message: facultyCode });
      loadOverview();
    } catch (error) {
      setToast({ type: 'error', title: 'Add faculty failed', message: error.message });
    }
  }

  async function handleCourseSubmit(event) {
    event.preventDefault();
    try {
      await createCourse({ name: courseName, courseCode });
      setCourseName('');
      setCourseCode('');
      setToast({ type: 'success', title: 'Course added', message: courseCode });
      loadOverview();
    } catch (error) {
      setToast({ type: 'error', title: 'Add course failed', message: error.message });
    }
  }

  async function handleStudentSubmit(event) {
    event.preventDefault();
    try {
      await createStudent({ name, studentCode });
      setName('');
      setStudentCode('');
      setToast({ type: 'success', title: 'Student added', message: studentCode });
      loadOverview();
    } catch (error) {
      setToast({ type: 'error', title: 'Add student failed', message: error.message });
    }
  }

  async function handleMapFaculty(event) {
    event.preventDefault();
    try {
      await mapFacultyToCourse({
        courseId: selectedCourseForFaculty,
        facultyId: selectedFaculty,
      });
      setToast({ type: 'success', title: 'Faculty mapped', message: 'Course ownership updated' });
      loadOverview();
    } catch (error) {
      setToast({ type: 'error', title: 'Faculty mapping failed', message: error.message });
    }
  }

  async function handleMapStudent(event) {
    event.preventDefault();
    try {
      await mapStudentToCourse({
        courseId: selectedCourseForStudent,
        studentId: selectedStudent,
      });
      setToast({ type: 'success', title: 'Student mapped', message: 'Course roster updated' });
      loadOverview();
    } catch (error) {
      setToast({ type: 'error', title: 'Student mapping failed', message: error.message });
    }
  }

  async function handleDelete(code) {
    try {
      await deleteStudent(code);
      setToast({ type: 'success', title: 'Student deleted', message: code });
      loadOverview();
    } catch (error) {
      setToast({ type: 'error', title: 'Delete failed', message: error.message });
    }
  }

  async function handleRemoveFacultyMapping(mappingId) {
    try {
      await unmapFacultyCourse(mappingId);
      setToast({ type: 'success', title: 'Faculty mapping removed', message: 'Removed' });
      loadOverview();
    } catch (error) {
      setToast({ type: 'error', title: 'Remove mapping failed', message: error.message });
    }
  }

  async function handleRemoveStudentMapping(mappingId) {
    try {
      await unmapStudentCourse(mappingId);
      setToast({ type: 'success', title: 'Student mapping removed', message: 'Removed' });
      loadOverview();
    } catch (error) {
      setToast({ type: 'error', title: 'Remove mapping failed', message: error.message });
    }
  }

  return (
    <main className={styles.page}>
      <Toast toast={toast} />
      <section className={styles.panel}>
        <h1>Admin Dashboard</h1>
        <p className={styles.sub}>Create entities and control course mappings.</p>
      </section>

      <section className={styles.panel}>
        <h2>Add Faculty</h2>
        <form className={styles.form} onSubmit={handleFacultySubmit}>
          <input value={facultyName} onChange={(event) => setFacultyName(event.target.value)} placeholder="Faculty name" className={styles.input} />
          <input value={facultyCode} onChange={(event) => setFacultyCode(event.target.value)} placeholder="Faculty code" className={styles.input} />
          <button className={styles.button} type="submit">Add faculty</button>
        </form>
      </section>

      <section className={styles.panel}>
        <h2>Add Course</h2>
        <form className={styles.form} onSubmit={handleCourseSubmit}>
          <input value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="Course name" className={styles.input} />
          <input value={courseCode} onChange={(event) => setCourseCode(event.target.value)} placeholder="Course code" className={styles.input} />
          <button className={styles.button} type="submit">Add course</button>
        </form>
      </section>

      <section className={styles.panel}>
        <h2>Add Student</h2>
        <form className={styles.form} onSubmit={handleStudentSubmit}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Student name" className={styles.input} />
          <input value={studentCode} onChange={(event) => setStudentCode(event.target.value)} placeholder="Student code" className={styles.input} />
          <button className={styles.button} type="submit">Add student</button>
        </form>
      </section>

      <section className={styles.panel}>
        <h2>Map Faculty to Course</h2>
        <form className={styles.form} onSubmit={handleMapFaculty}>
          <select className={styles.input} value={selectedCourseForFaculty} onChange={(event) => setSelectedCourseForFaculty(event.target.value)}>
            <option value="">Select course</option>
            {overview.courses.map((course) => (
              <option key={course.id} value={course.id}>{course.course_code} - {course.name}</option>
            ))}
          </select>
          <select className={styles.input} value={selectedFaculty} onChange={(event) => setSelectedFaculty(event.target.value)}>
            <option value="">Select faculty</option>
            {overview.faculties.map((faculty) => (
              <option key={faculty.id} value={faculty.id}>{faculty.faculty_code} - {faculty.name}</option>
            ))}
          </select>
          <button className={styles.button} type="submit" disabled={!selectedCourseForFaculty || !selectedFaculty}>Map faculty</button>
        </form>
      </section>

      <section className={styles.panel}>
        <h2>Map Student to Course</h2>
        <form className={styles.form} onSubmit={handleMapStudent}>
          <select className={styles.input} value={selectedCourseForStudent} onChange={(event) => setSelectedCourseForStudent(event.target.value)}>
            <option value="">Select course</option>
            {overview.courses.map((course) => (
              <option key={course.id} value={course.id}>{course.course_code} - {course.name}</option>
            ))}
          </select>
          <select className={styles.input} value={selectedStudent} onChange={(event) => setSelectedStudent(event.target.value)}>
            <option value="">Select student</option>
            {overview.students.map((student) => (
              <option key={student.id} value={student.id}>{student.student_code} - {student.name}</option>
            ))}
          </select>
          <button className={styles.button} type="submit" disabled={!selectedCourseForStudent || !selectedStudent}>Map student</button>
        </form>
      </section>

      <section className={styles.panel}>
        <h2>Faculty-Course Mappings</h2>
        <div className={styles.table}>
          {overview.courseFaculties.map((mapping) => (
            <div className={styles.row} key={mapping.id}>
              <span>{mapping.course_code} - {mapping.course_name}</span>
              <span>{mapping.faculty_code} - {mapping.faculty_name}</span>
              <button className={styles.delete} type="button" onClick={() => handleRemoveFacultyMapping(mapping.id)}>Remove</button>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Student-Course Mappings</h2>
        <div className={styles.table}>
          {overview.courseStudents.map((mapping) => (
            <div className={styles.row} key={mapping.id}>
              <span>{mapping.course_code} - {mapping.course_name}</span>
              <span>{mapping.student_code} - {mapping.student_name}</span>
              <button className={styles.delete} type="button" onClick={() => handleRemoveStudentMapping(mapping.id)}>Remove</button>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Students</h2>
        <div className={styles.table}>
          <div className={styles.headRow}>
            <span>Name</span>
            <span>Student Code</span>
            <span>Enrolled</span>
            <span />
          </div>
          {overview.students.map((student) => (
            <div className={styles.row} key={student.id}>
              <span>{student.name}</span>
              <span>{student.student_code}</span>
              <span>
                <span className={`${styles.badge} ${student.enrolled ? styles.ready : styles.waiting}`}>
                  {student.enrolled ? 'Enrolled' : 'Pending'}
                </span>
              </span>
              <button className={styles.delete} type="button" onClick={() => handleDelete(student.student_code)}>Delete</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
