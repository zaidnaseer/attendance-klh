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
