import { useNavigate } from 'react-router-dom';
import layout from './AdminLayout.module.css';

const titles = {
    overview: 'Overview',
    faculty: 'Faculty Members',
    students: 'Students',
    courses: 'Courses',
    mappings: 'Course Mappings',
};

export default function Topbar({ activeTab, overview }) {
    const navigate = useNavigate();
    
    return (
        <div className={layout.topbar}>
            <div className={layout.pageTitle}>{titles[activeTab]}</div>
            <div className={layout.topbarRight}>
                <div className={layout.statChip}>
                    <span>{overview.faculties.length}</span> faculty
                </div>
                <div className={layout.statChip}>
                    <span>{overview.students.length}</span> students
                </div>
                <div className={layout.statChip}>
                    <span>{overview.courses.length}</span> courses
                </div>
                <button 
                    onClick={() => navigate('/')} 
                    style={{
                        padding: '6px 14px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#fecaca',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginLeft: '8px',
                        transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                >
                    Logout
                </button>
            </div>
        </div>
    );
}
