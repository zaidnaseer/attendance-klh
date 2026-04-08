import layout from './AdminLayout.module.css';

const tabs = [
  { id: 'overview', label: 'Overview', section: 'Main' },
  { id: 'faculty', label: 'Faculty', section: 'Management' },
  { id: 'students', label: 'Students', section: 'Management' },
  { id: 'courses', label: 'Courses', section: 'Management' },
  { id: 'mappings', label: 'Mappings', section: 'Mapping' },
];

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside className={layout.sidebar}>
      <div className={layout.logo}>
        <div className={layout.logoIcon}>◆</div>
        <div>
          <div className={layout.logoText}>Academix</div>
          <div className={layout.logoSub}>Admin</div>
        </div>
      </div>

      <nav className={layout.nav}>
        <div className={layout.navLabel}>Main</div>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${layout.navItem} ${activeTab === tab.id ? layout.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={layout.sidebarFooter}>
        <div className={layout.adminBadge}>
          <div className={layout.avatar}>AD</div>
          <div>
            <div className={layout.adminInfo}>Admin</div>
            <div className={layout.adminRole}>Super Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
