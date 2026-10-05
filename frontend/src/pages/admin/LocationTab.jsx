import { useEffect, useMemo, useState } from 'react';
import { getInstitution, saveInstitution } from '../../lib/api';
import { formatDistance, getCurrentPosition } from '../../lib/geolocation';
import table from './AdminTable.module.css';
import styles from './LocationTab.module.css';

const DEFAULT_RADIUS = 200;
const MIN_RADIUS = 10;
const MAX_RADIUS = 5000;
const RADIUS_PRESETS = [100, 200, 500, 1000];

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

function validate(form) {
    const errors = {};
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    const radius = Number(form.radius);

    if (form.latitude.trim() === '') errors.latitude = 'Required';
    else if (!Number.isFinite(lat) || Math.abs(lat) > 90) errors.latitude = 'Must be between -90 and 90';

    if (form.longitude.trim() === '') errors.longitude = 'Required';
    else if (!Number.isFinite(lng) || Math.abs(lng) > 180) errors.longitude = 'Must be between -180 and 180';

    if (form.radius.trim() === '' || !Number.isInteger(radius) || radius < MIN_RADIUS || radius > MAX_RADIUS) {
        errors.radius = `Whole number between ${MIN_RADIUS} and ${MAX_RADIUS} m`;
    }
    return errors;
}

export default function LocationTab({ setToast }) {
    const [institution, setInstitution] = useState(null);
    const [form, setForm] = useState(toForm(null));
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [accuracy, setAccuracy] = useState(null);
    const [touched, setTouched] = useState({});
    const [mapLoaded, setMapLoaded] = useState(false);

    useEffect(() => {
        getInstitution()
            .then((data) => {
                setInstitution(data.institution);
                setForm(toForm(data.institution));
            })
            .catch((error) => setToast({ type: 'error', title: 'Load failed', message: error.message }))
            .finally(() => setIsLoading(false));
    }, []);

    const errors = useMemo(() => validate(form), [form]);
    const isValid = Object.keys(errors).length === 0;
    const saved = useMemo(() => toForm(institution), [institution]);
    const isDirty = Object.keys(saved).some((key) => saved[key] !== form[key]);

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    const radius = Number(form.radius);
    const hasValidCoords = !errors.latitude && !errors.longitude;
    const previewRadius = !errors.radius ? radius : DEFAULT_RADIUS;
    const mapSrc = hasValidCoords ? mapEmbedUrl(lat, lng, previewRadius) : null;

    // Reset the loading shimmer whenever the map URL changes
    useEffect(() => { setMapLoaded(false); }, [mapSrc]);

    function updateField(field, value) {
        setAccuracy(null);
        // Allow pasting "lat, lng" (e.g. copied from Google Maps) into either coordinate field
        const pair = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if ((field === 'latitude' || field === 'longitude') && pair) {
            setForm((prev) => ({ ...prev, latitude: pair[1], longitude: pair[2] }));
            setTouched((prev) => ({ ...prev, latitude: true, longitude: true }));
            return;
        }
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));
    const showError = (field) => (touched[field] ? errors[field] : undefined);

    function discardChanges() {
        setForm(toForm(institution));
        setTouched({});
        setAccuracy(null);
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
            setTouched((prev) => ({ ...prev, latitude: true, longitude: true }));
            setAccuracy(Math.round(position.accuracy));
        } catch (error) {
            setToast({ type: 'error', title: 'Location failed', message: error.message });
        } finally {
            setIsLocating(false);
        }
    }

    async function handleSave(event) {
        event.preventDefault();
        if (!isValid) {
            setTouched({ latitude: true, longitude: true, radius: true });
            return;
        }

        setIsSaving(true);
        try {
            const data = await saveInstitution({ name: form.name, latitude: lat, longitude: lng, radiusMeters: radius });
            setInstitution(data.institution);
            setForm(toForm(data.institution));
            setTouched({});
            setAccuracy(null);
            setToast({ type: 'success', title: 'Location saved', message: 'GPS verification will use this location' });
        } catch (error) {
            setToast({ type: 'error', title: 'Save failed', message: error.message });
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return (
            <>
                <div className={table.sectionHeader}><h2>Institution Location</h2></div>
                <div className={styles.layout} aria-busy="true" aria-label="Loading location">
                    <div className={`${styles.card} ${styles.skeleton}`} style={{ minHeight: 420 }} />
                    <div className={`${styles.mapCard} ${styles.skeleton}`} style={{ minHeight: 420 }} />
                </div>
            </>
        );
    }

    return (
        <>
            <div className={table.sectionHeader}>
                <h2>Institution Location</h2>
                <div className={styles.headerBadges}>
                    {isDirty && <span className={styles.unsaved}>Unsaved changes</span>}
                    {institution ? (
                        <span className={`${table.badge} ${table.badgeGreen}`}>Configured</span>
                    ) : (
                        <span className={`${table.badge} ${table.badgeGray}`}>Not configured</span>
                    )}
                </div>
            </div>

            <p className={styles.intro}>
                Students in GPS-verified sessions must be within the radius of this point to mark attendance.
            </p>

            {!institution && (
                <div className={`${styles.callout} ${styles.calloutInfo}`} role="status">
                    Faculty can&apos;t choose GPS verification until a location is saved here.
                </div>
            )}

            <div className={styles.layout}>
                <form className={styles.card} onSubmit={handleSave} noValidate>
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
                                className={`${styles.input} ${showError('latitude') ? styles.inputError : ''}`}
                                inputMode="decimal"
                                value={form.latitude}
                                onChange={(e) => updateField('latitude', e.target.value)}
                                onBlur={() => touch('latitude')}
                                placeholder="e.g. 17.385044"
                                aria-invalid={!!showError('latitude')}
                            />
                            {showError('latitude') && <span className={styles.errorText} role="alert">{errors.latitude}</span>}
                        </label>
                        <label className={styles.field}>
                            <span>Longitude</span>
                            <input
                                className={`${styles.input} ${showError('longitude') ? styles.inputError : ''}`}
                                inputMode="decimal"
                                value={form.longitude}
                                onChange={(e) => updateField('longitude', e.target.value)}
                                onBlur={() => touch('longitude')}
                                placeholder="e.g. 78.486671"
                                aria-invalid={!!showError('longitude')}
                            />
                            {showError('longitude') && <span className={styles.errorText} role="alert">{errors.longitude}</span>}
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
                        accuracy > 100 ? (
                            <div className={`${styles.callout} ${styles.calloutWarn}`} role="status">
                                Accuracy is only ±{accuracy} m. Enter the coordinates manually for a more precise point.
                            </div>
                        ) : (
                            <p className={styles.hint}>Location found (accuracy ±{accuracy} m).</p>
                        )
                    )}

                    <div className={styles.field}>
                        <div className={styles.radiusHead}>
                            <label htmlFor="radius-input">Allowed radius</label>
                            <strong className={styles.radiusValue}>
                                {errors.radius ? '—' : formatDistance(radius)}
                            </strong>
                        </div>
                        <input
                            className={styles.slider}
                            type="range"
                            min={MIN_RADIUS}
                            max={MAX_RADIUS}
                            step={10}
                            value={errors.radius ? DEFAULT_RADIUS : radius}
                            onChange={(e) => { updateField('radius', e.target.value); touch('radius'); }}
                            aria-label="Allowed radius in meters"
                        />
                        <div className={styles.presets}>
                            {RADIUS_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    className={`${styles.preset} ${radius === preset ? styles.presetActive : ''}`}
                                    onClick={() => { updateField('radius', String(preset)); touch('radius'); }}
                                >
                                    {formatDistance(preset)}
                                </button>
                            ))}
                        </div>
                        <input
                            id="radius-input"
                            className={`${styles.input} ${showError('radius') ? styles.inputError : ''}`}
                            type="number"
                            inputMode="numeric"
                            min={MIN_RADIUS}
                            max={MAX_RADIUS}
                            step={1}
                            value={form.radius}
                            onChange={(e) => updateField('radius', e.target.value)}
                            onBlur={() => touch('radius')}
                            aria-invalid={!!showError('radius')}
                            aria-label="Allowed radius in meters"
                        />
                        {showError('radius') && <span className={styles.errorText} role="alert">{errors.radius}</span>}
                    </div>
                    <p className={styles.hint}>
                        Phone GPS indoors is often off by 20–50 m, so 150–300 m works well for most campuses.
                    </p>

                    <div className={styles.actions}>
                        <button className={table.btnPrimary} type="submit" disabled={isSaving || !isDirty || !isValid}>
                            {isSaving ? 'Saving…' : 'Save Location'}
                        </button>
                        {isDirty && institution && (
                            <button className={styles.ghostBtn} type="button" onClick={discardChanges} disabled={isSaving}>
                                Discard changes
                            </button>
                        )}
                    </div>
                    {institution?.updated_at && (
                        <p className={styles.hint}>Last updated {new Date(institution.updated_at).toLocaleString()}</p>
                    )}
                </form>

                <div className={styles.mapCard}>
                    {mapSrc ? (
                        <>
                            <div className={`${styles.mapFrame} ${mapLoaded ? '' : styles.skeleton}`}>
                                <iframe
                                    title="Institution location preview"
                                    className={styles.map}
                                    src={mapSrc}
                                    loading="lazy"
                                    onLoad={() => setMapLoaded(true)}
                                />
                            </div>
                            <div className={styles.mapFooter}>
                                <span className={styles.legend}>
                                    📍 Pin = institution · students must be within {errors.radius ? '—' : formatDistance(previewRadius)}
                                </span>
                                <a
                                    className={styles.mapLink}
                                    href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Open larger map ↗
                                </a>
                            </div>
                        </>
                    ) : (
                        <div className={table.emptyState}>
                            Enter coordinates to preview the location.
                            <br />
                            <small>Use your current location, or paste “lat, lng” from Google Maps.</small>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
