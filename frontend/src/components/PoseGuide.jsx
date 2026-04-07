import styles from './PoseGuide.module.css';

const labels = {
  front: 'Look Straight',
  left: 'Look Slightly Left',
  right: 'Look Slightly Right',
  up: 'Tilt Up',
  down: 'Tilt Down',
};

function ArrowIcon({ pose }) {
  if (pose === 'front') {
    return (
      <svg className={styles.icon} viewBox="0 0 32 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="14" r="8" />
        <path d="M16 6v16" />
        <path d="M8 14h16" />
      </svg>
    );
  }

  const paths = {
    left: 'M28 14 L4 14 M4 14 L12 6 M4 14 L12 22',
    right: 'M4 14 L28 14 M28 14 L20 6 M28 14 L20 22',
    up: 'M14 28 L14 4 M14 4 L6 12 M14 4 L22 12',
    down: 'M14 4 L14 28 M14 28 L6 20 M14 28 L22 20',
  };

  return (
    <svg className={styles.icon} viewBox="0 0 32 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[pose]} />
    </svg>
  );
}

export default function PoseGuide({ poses, currentPoseIndex, passing, message }) {
  const currentPose = poses[currentPoseIndex] || poses[poses.length - 1];
  return (
    <section className={styles.guide}>
      <div>
        <div className={styles.label}>{labels[currentPose] || 'Ready'}</div>
        <div className={styles.message}>{message}</div>
      </div>
      <ArrowIcon pose={passing ? 'front' : currentPose} />
      <div className={styles.dots}>
        {poses.map((pose, index) => {
          const completed = index < currentPoseIndex;
          const active = index === currentPoseIndex;
          return (
            <span
              key={pose}
              className={`${styles.dot} ${completed ? styles.completed : ''} ${active ? styles.active : ''}`}
              aria-label={`${pose} pose`}
            />
          );
        })}
      </div>
    </section>
  );
}
