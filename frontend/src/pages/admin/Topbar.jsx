import layout from './AdminLayout.module.css';

const titles = {
    overview: 'Overview',
    faculty: 'Faculty Members',
    students: 'Students',
    courses: 'Courses',
    mappings: 'Course Mappings',
};

export default function Topbar({ activeTab, overview }) {
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
            </div>
        </div>
    );
}
