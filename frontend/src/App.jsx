import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Admin from './pages/Admin';
import Enroll from './pages/Enroll';
import Verify from './pages/Verify';
import Faculty from './pages/Faculty';
import Student from './pages/Student';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/faculty" element={<Faculty />} />
      <Route path="/student" element={<Student />} />
      <Route path="/enroll/:studentCode" element={<Enroll />} />
      <Route path="/verify/:studentCode" element={<Verify />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
