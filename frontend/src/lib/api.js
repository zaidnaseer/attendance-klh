const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const error = new Error((data && data.message) || 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function getStudents() {
  return request('/api/students');
}

export function createStudent(payload) {
  return request('/api/students', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getStudent(studentCode) {
  return request(`/api/students/${encodeURIComponent(studentCode)}`);
}

export function deleteStudent(studentCode) {
  return request(`/api/students/${encodeURIComponent(studentCode)}`, {
    method: 'DELETE',
  });
}

export function enrollStudent(studentCode, formData) {
  return request(`/api/enroll/${encodeURIComponent(studentCode)}`, {
    method: 'POST',
    body: formData,
  });
}

export function verifyStudent(studentCode, formData) {
  return request(`/api/verify/${encodeURIComponent(studentCode)}`, {
    method: 'POST',
    body: formData,
  });
}

export function getAdminOverview() {
  return request('/api/admin/overview');
}

export function createFaculty(payload) {
  return request('/api/admin/faculties', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteFaculty(facultyCode) {
  return request(`/api/admin/faculties/${encodeURIComponent(facultyCode)}`, {
    method: 'DELETE',
  });
}

export function createCourse(payload) {
  return request('/api/admin/courses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteCourse(courseCode) {
  return request(`/api/admin/courses/${encodeURIComponent(courseCode)}`, {
    method: 'DELETE',
  });
}

export function mapFacultyToCourse(payload) {
  return request('/api/admin/course-faculties', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function unmapFacultyCourse(mappingId) {
  return request(`/api/admin/course-faculties/${encodeURIComponent(mappingId)}`, {
    method: 'DELETE',
  });
}

export function mapStudentToCourse(payload) {
  return request('/api/admin/course-students', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function unmapStudentCourse(mappingId) {
  return request(`/api/admin/course-students/${encodeURIComponent(mappingId)}`, {
    method: 'DELETE',
  });
}

export function getFacultyDashboard(facultyCode) {
  return request(`/api/faculty/${encodeURIComponent(facultyCode)}/dashboard`);
}

export function facultyAddStudent(facultyCode, courseId, studentId) {
  return request(`/api/faculty/${encodeURIComponent(facultyCode)}/courses/${encodeURIComponent(courseId)}/students`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}

export function facultyRemoveStudent(facultyCode, courseId, studentId) {
  return request(`/api/faculty/${encodeURIComponent(facultyCode)}/courses/${encodeURIComponent(courseId)}/students/${encodeURIComponent(studentId)}`, {
    method: 'DELETE',
  });
}

export function startAttendanceSession(facultyCode, courseId) {
  return request(`/api/faculty/${encodeURIComponent(facultyCode)}/courses/${encodeURIComponent(courseId)}/sessions/start`, {
    method: 'POST',
  });
}

export function getStudentDashboard(studentCode) {
  return request(`/api/student/${encodeURIComponent(studentCode)}/dashboard`);
}

export function markStudentAttendance(studentCode, sessionId) {
  return request(`/api/student/${encodeURIComponent(studentCode)}/attendance/mark`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}
