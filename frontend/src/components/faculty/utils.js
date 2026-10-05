export const THRESHOLD = 75;

export const VERIFICATION_OPTIONS = [
    { value: 'qr', label: 'QR Code' },
    { value: 'gps', label: 'GPS' },
    { value: 'both', label: 'QR + GPS' },
];

export const usesQr = (mode) => mode === 'qr' || mode === 'both';
export const usesGps = (mode) => mode === 'gps' || mode === 'both';

export function courseTitle(course) {
    return course.section ? `${course.course_code} · Section ${course.section}` : course.course_code;
}

// Per-student attendance across ended sessions: Map(studentId -> { attended, total, pct })
export function studentStats(course) {
    const past = course.pastSessions || [];
    const stats = new Map();
    for (const st of course.students) {
        const attended = past.filter((p) => (p.present_ids || []).includes(st.id)).length;
        stats.set(st.id, {
            attended,
            total: past.length,
            pct: past.length ? Math.round((attended / past.length) * 100) : null,
        });
    }
    return stats;
}

export function lastSessionPct(course) {
    const last = (course.pastSessions || [])[0];
    if (!last || course.students.length === 0) return null;
    return Math.round((Number(last.present_count) / course.students.length) * 100);
}

// Groups courses by subject name; live classes first inside each group, groups with a live class first.
export function groupBySubject(courses) {
    const groups = new Map();
    for (const c of courses) {
        if (!groups.has(c.name)) groups.set(c.name, []);
        groups.get(c.name).push(c);
    }
    const live = (c) => (c.activeSession ? 0 : 1);
    return [...groups.entries()]
        .map(([subject, items]) => ({
            subject,
            items: [...items].sort((a, b) => live(a) - live(b) || a.course_code.localeCompare(b.course_code)),
        }))
        .sort((a, b) => live(a.items[0]) - live(b.items[0]) || a.subject.localeCompare(b.subject));
}

export function downloadCsv(filename, rows) {
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
