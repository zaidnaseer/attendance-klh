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
import layout from './admin/AdminLayout.module.css';
import {
  AdminModal,
  CoursesTab,
  FacultyTab,
  MappingsTab,
  OverviewTab,
  Sidebar,
  StudentsTab,
  Topbar,
  getAvatarStyle,
  getInitials,
} from './admin/index.js';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState({
    faculties: [],
    courses: [],
    students: [],
    courseFaculties: [],
    courseStudents: [],
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [toast, setToast] = useState(null);

  const [facultyForm, setFacultyForm] = useState({ name: '', code: '' });
  const [courseForm, setCourseForm] = useState({ name: '', code: '' });
  const [studentForm, setStudentForm] = useState({ name: '', code: '' });
  const [facultyMapForm, setFacultyMapForm] = useState({ courseId: '', facultyId: '' });
  const [studentMapForm, setStudentMapForm] = useState({ courseId: '', studentId: '' });

  const totalMappings = overview.courseFaculties.length + overview.courseStudents.length;

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

  const resetForms = () => {
    setFacultyForm({ name: '', code: '' });
    setCourseForm({ name: '', code: '' });
    setStudentForm({ name: '', code: '' });
    setFacultyMapForm({ courseId: '', facultyId: '' });
    setStudentMapForm({ courseId: '', studentId: '' });
  };

  const openModal = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalType('');
    resetForms();
  };

  const handleSaveModal = async () => {
    try {
      if (modalType === 'faculty') {
        if (!facultyForm.name || !facultyForm.code) {
          setToast({ type: 'error', title: 'Validation', message: 'All fields required' });
          return;
        }
        await createFaculty({ name: facultyForm.name, facultyCode: facultyForm.code });
        setToast({ type: 'success', title: 'Faculty added', message: facultyForm.code });
      }

      if (modalType === 'course') {
        if (!courseForm.name || !courseForm.code) {
          setToast({ type: 'error', title: 'Validation', message: 'All fields required' });
          return;
        }
        await createCourse({ name: courseForm.name, courseCode: courseForm.code });
        setToast({ type: 'success', title: 'Course added', message: courseForm.code });
      }

      if (modalType === 'student') {
        if (!studentForm.name || !studentForm.code) {
          setToast({ type: 'error', title: 'Validation', message: 'All fields required' });
          return;
        }
        await createStudent({ name: studentForm.name, studentCode: studentForm.code });
        setToast({ type: 'success', title: 'Student added', message: studentForm.code });
      }

      if (modalType === 'mapFaculty') {
        if (!facultyMapForm.courseId || !facultyMapForm.facultyId) {
          setToast({
            type: 'error',
            title: 'Validation',
            message: 'Please select both course and faculty',
          });
          return;
        }
        await mapFacultyToCourse({
          courseId: facultyMapForm.courseId,
          facultyId: facultyMapForm.facultyId,
        });
        setToast({ type: 'success', title: 'Faculty mapped', message: 'Course assignment updated' });
      }

      if (modalType === 'mapStudent') {
        if (!studentMapForm.courseId || !studentMapForm.studentId) {
          setToast({
            type: 'error',
            title: 'Validation',
            message: 'Please select both course and student',
          });
          return;
        }
        await mapStudentToCourse({
          courseId: studentMapForm.courseId,
          studentId: studentMapForm.studentId,
        });
        setToast({ type: 'success', title: 'Student enrolled', message: 'Course enrollment updated' });
      }

      await loadOverview();
      closeModal();
    } catch (error) {
      setToast({ type: 'error', title: 'Error', message: error.message });
    }
  };

  const handleDeleteStudent = async (studentCode) => {
    if (!window.confirm('Delete this student?')) {
      return;
    }

    try {
      await deleteStudent(studentCode);
      setToast({ type: 'success', title: 'Student deleted', message: studentCode });
      await loadOverview();
    } catch (error) {
      setToast({ type: 'error', title: 'Delete failed', message: error.message });
    }
  };

  const handleRemoveFacultyMapping = async (mappingId) => {
    try {
      await unmapFacultyCourse(mappingId);
      setToast({ type: 'success', title: 'Mapping removed', message: '' });
      await loadOverview();
    } catch (error) {
      setToast({ type: 'error', title: 'Remove failed', message: error.message });
    }
  };

  const handleRemoveStudentMapping = async (mappingId) => {
    try {
      await unmapStudentCourse(mappingId);
      setToast({ type: 'success', title: 'Mapping removed', message: '' });
      await loadOverview();
    } catch (error) {
      setToast({ type: 'error', title: 'Remove failed', message: error.message });
    }
  };

  return (
    <div className={layout.dashboard}>
      <Toast toast={toast} />

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className={layout.main}>
        <Topbar activeTab={activeTab} overview={overview} />

        <div className={layout.content}>
          {activeTab === 'overview' && (
            <OverviewTab
              overview={overview}
              totalMappings={totalMappings}
              getInitials={getInitials}
              getAvatarStyle={getAvatarStyle}
            />
          )}

          {activeTab === 'faculty' && (
            <FacultyTab overview={overview} onAddFaculty={() => openModal('faculty')} />
          )}

          {activeTab === 'students' && (
            <StudentsTab
              overview={overview}
              onAddStudent={() => openModal('student')}
              onDeleteStudent={handleDeleteStudent}
            />
          )}

          {activeTab === 'courses' && (
            <CoursesTab overview={overview} onAddCourse={() => openModal('course')} />
          )}

          {activeTab === 'mappings' && (
            <MappingsTab
              overview={overview}
              onAssignFaculty={() => openModal('mapFaculty')}
              onEnrollStudent={() => openModal('mapStudent')}
              onRemoveFacultyMapping={handleRemoveFacultyMapping}
              onRemoveStudentMapping={handleRemoveStudentMapping}
            />
          )}
        </div>
      </div>

      <AdminModal
        modalOpen={modalOpen}
        modalType={modalType}
        closeModal={closeModal}
        handleSaveModal={handleSaveModal}
        facultyForm={facultyForm}
        setFacultyForm={setFacultyForm}
        studentForm={studentForm}
        setStudentForm={setStudentForm}
        courseForm={courseForm}
        setCourseForm={setCourseForm}
        facultyMapForm={facultyMapForm}
        setFacultyMapForm={setFacultyMapForm}
        studentMapForm={studentMapForm}
        setStudentMapForm={setStudentMapForm}
        overview={overview}
      />
    </div>
  );
}
