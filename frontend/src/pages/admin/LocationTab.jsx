import { useEffect, useState } from 'react';
import { getInstitution, saveInstitution } from '../../lib/api';
import { getCurrentPosition } from '../../lib/geolocation';
import table from './AdminTable.module.css';
import styles from './LocationTab.module.css';

const DEFAULT_RADIUS = 200;

function toForm(institution) {
    return {
        name: institution?.name || '',
        latitude: institution ? String(institution.latitude) : '',
        longitude: institution ? String(institution.longitude) : '',
        radius: String(institution?.radius_meters ?? DEFAULT_RADIUS),
    };
}

function mapEmbedUrl(lat, lng, radius) {
    // Show roughly 2.5x the radius around the marker
    const dLat = (radius * 2.5) / 111320;
    const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
    const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].join(',');
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export default function LocationTab({ setToast }) {
    const [institution, setInstitution] = useState(null);
    const [form, setForm] = useState(toForm(null));
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [accuracy, setAccuracy] = useState(null);

    useEffect(() => {
        getInstitution()
            .then((data) => {
                setInstitution(data.institution);
                setForm(toForm(data.institution));
            })
            .catch((error) => setToast({ type: 'error', title: 'Load failed', message: error.message }))
            .finally(() => setIsLoading(false));
    }, []);

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    const radius = Number(form.radius);
    const hasValidCoords = form.latitude !== '' && form.longitude !== ''
        && Number.isFinite(lat) && Number.isFinite(lng)
        && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

    function updateField(field, value) {
        // Allow pasting "lat, lng" (e.g. copied from Google Maps) into either coordinate field
        const pair = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if ((field === 'latitude' || field === 'longitude') && pair) {
            setForm((prev) => ({ ...prev, latitude: pair[1], longitude: pair[2] }));
            return;
        }
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function useCurrentLocation() {
        setIsLocating(true);
        try {
            const position = await getCurrentPosition();
            setForm((prev) => ({
                ...prev,
                latitude: position.latitude.toFixed(6),
                longitude: position.longitude.toFixed(6),
            }));
            setAccuracy(Math.round(position.accuracy));
        } catch (error) {
            setToast({ type: 'error', title: 'Location failed', message: error.message });
        } finally {
            setIsLocating(false);
        }
    }

    async function handleSave(event) {
        event.preventDefault();
        if (!hasValidCoords) {
            setToast({ type: 'error', title: 'Validation', message: 'Enter a valid latitude and longitude' });
            return;
        }
        if (!Number.isInteger(radius) || radius < 10 || radius > 5000) {
            setToast({ type: 'error', title: 'Validation', message: 'Radius must be a whole number between 10 and 5000 meters' });
            return;
        }

        setIsSaving(true);
        try {
            const data = await saveInstitution({ name: form.name, latitude: lat, longitude: lng, radiusMeters: radius });
            setInstitution(data.institution);
            setForm(toForm(data.institution));
            setToast({ type: 'success', title: 'Location saved', message: 'GPS verification will use this location' });
        } catch (error) {
            setToast({ type: 'error', title: 'Save failed', message: error.message });
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return <div className={table.emptyState}>Loading location…</div>;
    }

    return (
        <>
            <div className={table.sectionHeader}>
                <h2>Institution Location</h2>
                {institution ? (
                    <span className={`${table.badge} ${table.badgeGreen}`}>Configured</span>
                ) : (
                    <span className={`${table.badge} ${table.badgeGray}`}>Not configured</span>
                )}
            </div>

            <p className={styles.intro}>
                Students in GPS-verified sessions must be within the radius of this point to mark attendance.
            </p>

            <div className={styles.layout}>
                <form className={styles.card} onSubmit={handleSave}>
                    <label className={styles.field}>
                        <span>Institution name</span>
                        <input
                            className={styles.input}
                            value={form.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            placeholder="e.g. Main Campus"
                        />
                    </label>

                    <div className={styles.row}>
                        <label className={styles.field}>
                            <span>Latitude</span>
                            <input
                                className={styles.input}
                                inputMode="decimal"
                                value={form.latitude}
                                onChange={(e) => updateField('latitude', e.target.value)}
                                placeholder="e.g. 12.971599"
                            />
                        </label>
                        <label className={styles.field}>
                            <span>Longitude</span>
                            <input
                                className={styles.input}
                                inputMode="decimal"
                                value={form.longitude}
                                onChange={(e) => updateField('longitude', e.target.value)}
                                placeholder="e.g. 77.594566"
                            />
                        </label>
                    </div>
                    <p className={styles.hint}>
                        Tip: paste “lat, lng” copied from Google Maps into either field.
                    </p>

                    <button
                        className={styles.secondaryBtn}
                        type="button"
                        onClick={useCurrentLocation}
                        disabled={isLocating}
                    >
                        {isLocating ? 'Locating…' : 'Use my current location'}
                    </button>
                    {accuracy !== null && (
                        <p className={styles.hint}>
                            Accuracy ±{accuracy} m{accuracy > 100 ? ' — low accuracy, consider entering coordinates manually.' : ''}
                        </p>
                    )}

                    <label className={styles.field}>
                        <span>Allowed radius (meters)</span>
                        <input
                            className={styles.input}
                            type="number"
                            min={10}
                            max={5000}
                            step={1}
                            value={form.radius}
                            onChange={(e) => updateField('radius', e.target.value)}
                        />
                    </label>
                    <p className={styles.hint}>
                        Phone GPS indoors is often off by 20–50 m, so 150–300 m works well for most campuses.
                    </p>

                    <button className={table.btnPrimary} type="submit" disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save Location'}
                    </button>
                    {institution?.updated_at && (
                        <p className={styles.hint}>Last updated {new Date(institution.updated_at).toLocaleString()}</p>
                    )}
                </form>

                <div className={styles.mapCard}>
                    {hasValidCoords ? (
                        <>
                            <iframe
                                title="Institution location preview"
                                className={styles.map}
                                src={mapEmbedUrl(lat, lng, Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_RADIUS)}
                                loading="lazy"
                            />
                            <a
                                className={styles.mapLink}
                                href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Open larger map ↗
                            </a>
                        </>
                    ) : (
                        <div className={table.emptyState}>Enter coordinates to preview the location</div>
                    )}
                </div>
            </div>
        </>
    );
}
