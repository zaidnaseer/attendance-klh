import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { enrollStudent } from '../lib/api';
import { useFaceDetector } from '../hooks/useFaceDetector';
import PoseGuide from './PoseGuide';
import styles from './CameraView.module.css';

const POSES = ['front', 'left', 'right', 'up', 'down'];
const MIN_FACE_WIDTH_RATIO = 0.26;
const MIN_FACE_AREA_RATIO = 0.09;
const CENTER_MARGIN_X = 0.13;
const CENTER_MARGIN_Y = 0.13;
const UP_DOWN_PITCH_MIN_DELTA = 0.07;
const UP_DOWN_PITCH_MAX_DELTA = 0.34;
const LEFT_RIGHT_YAW_MIN_THRESHOLD = 0.085;
const LEFT_RIGHT_YAW_MAX_THRESHOLD = 0.18;
const poseMessages = {
  front: 'Look straight at the camera',
  left: 'Turn your head slightly to the left',
  right: 'Turn your head slightly to the right',
  up: 'Tilt your head up',
  down: 'Tilt your head down',
};

function getPoseLabel(pose) {
  return poseMessages[pose] || 'Hold still';
}

function createOffscreenCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToBlob(canvas) {
  if (canvas.convertToBlob) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawOverlay(ctx, video, detection, passing, steadyTimer, flashUntil, now) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!detection) {
    return;
  }

  const box = detection.boundingBox;
  // Match CSS object-fit: cover projection and horizontal mirroring.
  const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
  const projectedWidth = video.videoWidth * scale;
  const projectedHeight = video.videoHeight * scale;
  const offsetX = (canvas.width - projectedWidth) / 2;
  const offsetY = (canvas.height - projectedHeight) / 2;
  const x = offsetX + (video.videoWidth - (box.originX + box.width)) * scale;
  const y = offsetY + box.originY * scale;
  const width = box.width * scale;
  const height = box.height * scale;
  const color = passing ? '#22c55e' : '#ef4444';
  const line = 3;
  const corner = 20;

  if (flashUntil > now) {
    ctx.fillStyle = 'rgba(34,197,94,0.2)';
    ctx.fillRect(x, y, width, height);
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.moveTo(x, y + corner);
  ctx.lineTo(x, y);
  ctx.lineTo(x + corner, y);
  ctx.moveTo(x + width - corner, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + corner);
  ctx.moveTo(x, y + height - corner);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + corner, y + height);
  ctx.moveTo(x + width - corner, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - corner);
  ctx.stroke();

  if (passing && steadyTimer > 0) {
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(x + width - 16, y + 16, 12, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (steadyTimer / 1500));
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function getPrimaryDetection(detections) {
  return detections.slice().sort((a, b) => {
    const aArea = a.boundingBox.width * a.boundingBox.height;
    const bArea = b.boundingBox.width * b.boundingBox.height;
    return bArea - aArea;
  })[0];
}

function sampleBrightness(video, box) {
  const cropWidth = 32;
  const cropHeight = 32;
  const offscreen = createOffscreenCanvas(cropWidth, cropHeight);
  const context = offscreen.getContext('2d', { willReadFrequently: true });
  context.drawImage(video, box.originX, box.originY, box.width, box.height, 0, 0, cropWidth, cropHeight);
  const imageData = context.getImageData(0, 0, cropWidth, cropHeight).data;
  let total = 0;
  let count = 0;
  for (let index = 0; index < imageData.length; index += 4) {
    total += 0.299 * imageData[index] + 0.587 * imageData[index + 1] + 0.114 * imageData[index + 2];
    count += 1;
  }
  return total / count;
}

async function capturePose(video, box) {
  const horizontalPadding = 1.8;
  const verticalPadding = 2.1;
  const centerX = box.originX + box.width / 2;
  const centerY = box.originY + box.height * 0.52;
  const cropWidth = clamp(box.width * horizontalPadding, 1, video.videoWidth);
  const cropHeight = clamp(box.height * verticalPadding, 1, video.videoHeight);
  const sourceX = clamp(centerX - cropWidth / 2, 0, Math.max(1, video.videoWidth - cropWidth));
  const sourceY = clamp(centerY - cropHeight / 2, 0, Math.max(1, video.videoHeight - cropHeight));
  const canvas = createOffscreenCanvas(Math.round(cropWidth), Math.round(cropHeight));
  const context = canvas.getContext('2d');
  context.drawImage(video, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas);
}

export default function CameraView({ studentCode, studentName, onSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameIdRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const steadyTimerRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const neutralPitchRef = useRef(null);
  const poseStartPitchRef = useRef(null);
  const smoothedPitchRef = useRef(null);
  const activePoseRef = useRef(POSES[0]);
  const currentPoseIndexRef = useRef(0);
  const capturedBlobsRef = useRef(new Array(POSES.length).fill(null));
  const flashUntilRef = useRef(0);
  const submittingRef = useRef(false);
  const retryPoseIndexRef = useRef(0);
  const previewUrlsRef = useRef(new Set());
  const { detector, ready, error, retryDetector } = useFaceDetector();
  const [displayPoseIndex, setDisplayPoseIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Starting camera');
  const [passing, setPassing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(null);
  const [canRetrySubmit, setCanRetrySubmit] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedPreviews, setCapturedPreviews] = useState(new Array(POSES.length).fill(null));

  const resetForPose = useCallback((poseIndex) => {
    currentPoseIndexRef.current = poseIndex;
    activePoseRef.current = POSES[poseIndex] || POSES[0];
    poseStartPitchRef.current = null;
    smoothedPitchRef.current = null;
    if (poseIndex === 0) {
      neutralPitchRef.current = null;
    }
    steadyTimerRef.current = 0;
    lastFrameTimeRef.current = performance.now();
    setDisplayPoseIndex(poseIndex);
    setCapturedPreviews((previous) => previous.map((value, index) => {
      if (index >= poseIndex && value) {
        URL.revokeObjectURL(value);
        previewUrlsRef.current.delete(value);
      }
      return index < poseIndex ? value : null;
    }));
  }, []);

  const stopLoop = useCallback(() => {
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
  }, []);

  const submitEnrollment = useCallback(async () => {
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    setCanRetrySubmit(false);

    const formData = new FormData();
    POSES.forEach((pose, index) => {
      const blob = capturedBlobsRef.current[index];
      if (blob) {
        formData.append(pose, blob, `${pose}.jpg`);
      }
    });

    try {
      const result = await enrollStudent(studentCode, formData);
      setSuccess(result);
      onSuccess?.(result);
      stopLoop();
    } catch (error) {
      const code = error.data?.code;
      if (code === 'SPOOF_DETECTED') {
        const failedPoseIndex = POSES.indexOf(error.data.pose);
        setSubmitError(`Liveness check failed on ${error.data.pose} pose.`);
        retryPoseIndexRef.current = failedPoseIndex >= 0 ? failedPoseIndex : currentPoseIndexRef.current;
        setTimeout(() => {
          for (let index = retryPoseIndexRef.current; index < capturedBlobsRef.current.length; index += 1) {
            capturedBlobsRef.current[index] = null;
          }
          setSubmitError(`Retrying from ${POSES[retryPoseIndexRef.current]} pose...`);
          resetForPose(retryPoseIndexRef.current);
          submittingRef.current = false;
          setSubmitting(false);
          startLoop();
        }, 2000);
        return;
      }
      if (code === 'DUPLICATE_FOUND') {
        setSubmitError('You may already be enrolled. Contact your administrator.');
        stopLoop();
        return;
      }
      if (code === 'ALREADY_ENROLLED') {
        setSubmitError('You are already enrolled.');
        stopLoop();
        return;
      }
      setSubmitError('Server is temporarily unavailable. Please try again.');
      setCanRetrySubmit(true);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [onSuccess, resetForPose, stopLoop, studentCode]);

  const startLoop = useCallback(() => {
    stopLoop();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const frame = async (now) => {
      if (!video || !detector || !ready || video.readyState < 2) {
        frameIdRef.current = requestAnimationFrame(frame);
        return;
      }

      const delta = lastFrameTimeRef.current ? now - lastFrameTimeRef.current : 16;
      lastFrameTimeRef.current = now;
      const poseIndex = currentPoseIndexRef.current;
      if (poseIndex >= POSES.length) {
        stopLoop();
        await submitEnrollment();
        return;
      }

      let detections = [];
      try {
        const result = detector.detectForVideo(video, now);
        detections = result.detections || [];
      } catch (detectionError) {
        setStatusMessage('Detection temporarily unavailable');
        frameIdRef.current = requestAnimationFrame(frame);
        return;
      }

      const primary = detections.length ? getPrimaryDetection(detections) : null;
      let nextPassing = false;
      let nextMessage = getPoseLabel(POSES[poseIndex]);

      if (!primary) {
        nextMessage = 'No face detected';
      } else if (detections.length > 1) {
        nextMessage = 'Only your face should be in frame';
      } else {
        const box = primary.boundingBox;
        const faceWidthRatio = box.width / video.videoWidth;
        const faceAreaRatio = (box.width * box.height) / (video.videoWidth * video.videoHeight);
        if (faceWidthRatio < MIN_FACE_WIDTH_RATIO && faceAreaRatio < MIN_FACE_AREA_RATIO) {
          nextMessage = 'Move closer to the camera';
        } else {
          const faceCenterX = (box.originX + box.width / 2) / video.videoWidth;
          const faceCenterY = (box.originY + box.height / 2) / video.videoHeight;
          if (
            faceCenterX < CENTER_MARGIN_X
            || faceCenterX > 1 - CENTER_MARGIN_X
            || faceCenterY < CENTER_MARGIN_Y
            || faceCenterY > 1 - CENTER_MARGIN_Y
          ) {
            nextMessage = 'Center your face in the frame';
          } else {
            const brightness = sampleBrightness(video, box);
            if (brightness < 60) {
              nextMessage = 'Too dark — improve your lighting';
            } else if (brightness > 220) {
              nextMessage = 'Too bright — move away from the light';
            } else {
              const keypoints = primary.keypoints || [];
              const pose = POSES[poseIndex];
              if (activePoseRef.current !== pose) {
                activePoseRef.current = pose;
                poseStartPitchRef.current = null;
              }
              if (keypoints.length >= 6) {
                const eyeMidX = (keypoints[0].x + keypoints[1].x) / 2;
                const eyeMidY = (keypoints[0].y + keypoints[1].y) / 2;
                const yaw = (keypoints[2].x - eyeMidX) / (box.width / video.videoWidth);
                const rawPitch = (keypoints[2].y - eyeMidY) / (box.height / video.videoHeight);
                const previousPitch = smoothedPitchRef.current;
                const pitch = previousPitch == null ? rawPitch : previousPitch * 0.65 + rawPitch * 0.35;
                smoothedPitchRef.current = pitch;
                if (poseStartPitchRef.current == null) {
                  poseStartPitchRef.current = pitch;
                }
                if (pose === 'front') {
                  // Build a per-user neutral pitch baseline while front pose passes.
                  const previousBaseline = neutralPitchRef.current;
                  neutralPitchRef.current = previousBaseline == null ? pitch : previousBaseline * 0.7 + pitch * 0.3;
                  nextPassing = true;
                  // Video preview is mirrored, so yaw sign is inverted relative to user-facing directions.
                } else if (pose === 'left') {
                  if (yaw > LEFT_RIGHT_YAW_MAX_THRESHOLD) {
                    nextMessage = 'Too far left. Turn slightly left only';
                  } else if (yaw > LEFT_RIGHT_YAW_MIN_THRESHOLD) {
                    nextPassing = true;
                  } else {
                    nextMessage = poseMessages[pose];
                  }
                } else if (pose === 'right') {
                  if (yaw < -LEFT_RIGHT_YAW_MAX_THRESHOLD) {
                    nextMessage = 'Too far right. Turn slightly right only';
                  } else if (yaw < -LEFT_RIGHT_YAW_MIN_THRESHOLD) {
                    nextPassing = true;
                  } else {
                    nextMessage = poseMessages[pose];
                  }
                } else if (pose === 'up') {
                  const baselinePitch = neutralPitchRef.current ?? poseStartPitchRef.current ?? pitch;
                  const pitchDelta = pitch - baselinePitch;
                  if (pitchDelta > -UP_DOWN_PITCH_MIN_DELTA) {
                    nextMessage = poseMessages[pose];
                  } else if (pitchDelta < -UP_DOWN_PITCH_MAX_DELTA) {
                    nextMessage = 'Too far up. Tilt slightly up only';
                  } else {
                    nextPassing = true;
                  }
                } else if (pose === 'down') {
                  const baselinePitch = neutralPitchRef.current ?? poseStartPitchRef.current ?? pitch;
                  const pitchDelta = pitch - baselinePitch;
                  if (pitchDelta < UP_DOWN_PITCH_MIN_DELTA) {
                    nextMessage = poseMessages[pose];
                  } else if (pitchDelta > UP_DOWN_PITCH_MAX_DELTA) {
                    nextMessage = 'Too far down. Tilt slightly down only';
                  } else {
                    nextPassing = true;
                  }
                } else {
                  nextMessage = poseMessages[pose];
                }
              } else if (pose === 'front') {
                // Keep front permissive even if keypoints are briefly missing.
                nextPassing = true;
              } else {
                nextMessage = poseMessages[pose];
              }
            }
          }
        }
      }

      setPassing(nextPassing);
      setStatusMessage(nextMessage);
      drawOverlay(context, video, primary, nextPassing, steadyTimerRef.current, flashUntilRef.current, now);

      if (nextPassing) {
        steadyTimerRef.current += delta;
      } else {
        steadyTimerRef.current = 0;
      }

      if (primary && nextPassing && steadyTimerRef.current >= 1500) {
        const blob = await capturePose(video, primary.boundingBox);
        capturedBlobsRef.current[poseIndex] = blob;
        const previewUrl = URL.createObjectURL(blob);
        previewUrlsRef.current.add(previewUrl);
        setCapturedPreviews((previous) => {
          if (previous[poseIndex]) {
            URL.revokeObjectURL(previous[poseIndex]);
            previewUrlsRef.current.delete(previous[poseIndex]);
          }
          const next = previous.slice();
          next[poseIndex] = previewUrl;
          return next;
        });
        flashUntilRef.current = now + 200;
        currentPoseIndexRef.current += 1;
        steadyTimerRef.current = 0;
        setDisplayPoseIndex(currentPoseIndexRef.current);
        if (currentPoseIndexRef.current >= POSES.length) {
          stopLoop();
          await submitEnrollment();
          return;
        }
      }

      frameIdRef.current = requestAnimationFrame(frame);
    };

    frameIdRef.current = requestAnimationFrame(frame);
  }, [detector, ready, stopLoop, submitEnrollment]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const resize = () => {
          if (!canvasRef.current || !videoRef.current) {
            return;
          }
          canvasRef.current.width = videoRef.current.clientWidth;
          canvasRef.current.height = videoRef.current.clientHeight;
        };

        resizeObserverRef.current = new ResizeObserver(resize);
        resizeObserverRef.current.observe(videoRef.current);
        resize();
        setCameraReady(true);
      } catch (startError) {
        setCameraReady(false);
        setStatusMessage('Unable to start camera. Check browser permissions.');
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopLoop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      setCameraReady(false);
    };
  }, [stopLoop]);

  useEffect(() => {
    if (!cameraReady || !detector || !ready || !streamRef.current) {
      return undefined;
    }

    startLoop();

    return () => {
      stopLoop();
    };
  }, [cameraReady, detector, ready, startLoop, stopLoop]);

  useEffect(() => {
    if (error) {
      setStatusMessage(error.message || 'Face detector failed to load');
      return;
    }

    if (!cameraReady) {
      setStatusMessage('Starting camera');
      return;
    }

    if (!ready) {
      setStatusMessage('Camera ready. Loading face detector...');
    }
  }, [cameraReady, ready, error]);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((preview) => {
      URL.revokeObjectURL(preview);
    });
    previewUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (cameraReady && ready && !error) {
      setStatusMessage(getPoseLabel(POSES[currentPoseIndexRef.current]));
    }
  }, [cameraReady, ready, error]);

  const retrySubmission = useCallback(() => {
    submitEnrollment();
  }, [submitEnrollment]);

  const retryFaceDetector = useCallback(() => {
    setStatusMessage('Retrying face detector...');
    retryDetector();
  }, [retryDetector]);

  const overlay = useMemo(() => {
    if (success) {
      return (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#22c55e', marginBottom: 14 }}>
              <circle cx="36" cy="36" r="30" />
              <path d="M22 37l9 9 19-21" />
            </svg>
            <h2>Enrollment complete!</h2>
            <p>{studentName || success.studentName}</p>
            <p>Redirecting to dashboard...</p>
          </div>
        </div>
      );
    }
    if (submitting) {
      return (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            <h2>Processing...</h2>
            <p>Submitting your enrollment package.</p>
          </div>
        </div>
      );
    }
    return null;
  }, [studentName, success, submitting]);

  return (
    <div className={styles.wrap}>
      {overlay}
      <PoseGuide poses={POSES} currentPoseIndex={displayPoseIndex} passing={passing} message={statusMessage} />
      <div className={styles.shell}>
        <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
      <div className={styles.status}>{submitError || statusMessage}</div>
      {canRetrySubmit ? (
        <div className={styles.actionRow}>
          <button type="button" className={styles.button} onClick={retrySubmission}>
            Retry Submission
          </button>
        </div>
      ) : null}
      {error ? (
        <div className={styles.actionRow}>
          <button type="button" className={styles.button} onClick={retryFaceDetector}>
            Retry Detector
          </button>
        </div>
      ) : null}
      <section className={styles.previewStrip} aria-label="Enrollment captures">
        {POSES.map((pose, index) => (
          <figure key={pose} className={styles.previewCard}>
            <div className={styles.previewFrame}>
              {capturedPreviews[index] ? (
                <img src={capturedPreviews[index]} alt={`${pose} capture`} className={styles.previewImage} />
              ) : (
                <span className={styles.previewPlaceholder}>Waiting</span>
              )}
            </div>
            <figcaption className={styles.previewLabel}>{pose}</figcaption>
          </figure>
        ))}
      </section>
    </div>
  );
}
