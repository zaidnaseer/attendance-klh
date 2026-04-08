import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

local_silent_face = str(Path(__file__).resolve().parent / 'silent_face')
sys.path.insert(0, local_silent_face)
sys.path.insert(0, '/app/silent_face')

from models.antispoofing import AntiSpoofingEnsemble
from models.embeddings import InsightFaceEmbeddingExtractor

MAX_UPLOAD_BYTES = 2 * 1024 * 1024


class ModelState:
    def __init__(self):
        self.antispoof = None
        self.embeddings = None
        self.loaded = False


state = ModelState()

@asynccontextmanager
async def lifespan(app: FastAPI):
    weights_dir = os.getenv('MODEL_DIR', '/app/weights')
    if not Path(weights_dir).exists():
        raise RuntimeError(f'Model directory missing: {weights_dir}')

    # Change to silent_face directory so relative paths work
    original_cwd = os.getcwd()
    os.chdir('/app/silent_face')
    
    try:
        start = time.perf_counter()
        state.antispoof = AntiSpoofingEnsemble(weights_dir)
        print(f'Loaded anti-spoofing ensemble in {time.perf_counter() - start:.2f}s')

        start = time.perf_counter()
        state.embeddings = InsightFaceEmbeddingExtractor()
        print(f'Loaded InsightFace buffalo_l in {time.perf_counter() - start:.2f}s')

        state.loaded = True
        yield
    finally:
        os.chdir(original_cwd)
        state.loaded = False


app = FastAPI(lifespan=lifespan)


@app.get('/health')
def health():
    if not state.loaded:
        return JSONResponse({'status': 'starting'}, status_code=503)
    return JSONResponse({'status': 'ok'})


@app.post('/analyze')
async def analyze(image: UploadFile = File(...), pose: str = Form(...)):
    try:
        if image.content_type not in {'image/jpeg', 'image/png'}:
            raise HTTPException(status_code=400, detail='Only JPEG or PNG images are accepted')

        image_bytes = await image.read()
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail='Image exceeds 2MB')

        np_buffer = np.frombuffer(image_bytes, dtype=np.uint8)
        decoded = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
        if decoded is None:
            raise HTTPException(status_code=400, detail='Invalid image data')

        spoof_score = float(state.antispoof.score(decoded))
        is_real = spoof_score < 0.6
        embedding = None

        if is_real:
            embedding = state.embeddings.extract(decoded)
            if embedding is None:
                return JSONResponse({'spoof_score': 1.0, 'is_real': False, 'embedding': None})

        return JSONResponse({'spoof_score': spoof_score, 'is_real': is_real, 'embedding': embedding})
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post('/verify')
async def verify(image: UploadFile = File(...)):
    try:
        if image.content_type not in {'image/jpeg', 'image/png'}:
            raise HTTPException(status_code=400, detail='Only JPEG or PNG images are accepted')

        image_bytes = await image.read()
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail='Image exceeds 2MB')

        np_buffer = np.frombuffer(image_bytes, dtype=np.uint8)
        decoded = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
        if decoded is None:
            raise HTTPException(status_code=400, detail='Invalid image data')

        spoof_score = float(state.antispoof.score(decoded))
        is_real = spoof_score < 0.6

        detection = state.embeddings.detect_and_extract(decoded)
        embedding = detection.get('embedding') if is_real else None

        return JSONResponse({
            'detector': 'retinaface',
            'recognizer': 'arcface',
            'face_detected': bool(detection.get('face_detected')),
            'face_count': int(detection.get('face_count', 0)),
            'spoof_score': spoof_score,
            'is_real': is_real,
            'embedding': embedding,
        })
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
