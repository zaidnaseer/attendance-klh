import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Admin from './pages/Admin';
import Enroll from './pages/Enroll';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/enroll/:studentCode" element={<Enroll />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
