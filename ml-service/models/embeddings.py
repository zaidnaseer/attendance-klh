from typing import Optional

import cv2
import numpy as np
from insightface.app import FaceAnalysis


class InsightFaceEmbeddingExtractor:
    def __init__(self):
        self.app = FaceAnalysis(name='buffalo_l')
        self.app.prepare(ctx_id=-1)

    def extract(self, image: np.ndarray) -> Optional[list[float]]:
        faces = self.app.get(image, max_num=1)
        if not faces:
            return None
        face = faces[0]
        embedding = getattr(face, 'normed_embedding', None)
        if embedding is None:
            embedding = getattr(face, 'embedding', None)
        if embedding is None:
            return None
        return np.asarray(embedding, dtype=np.float32).tolist()

    def detect_and_extract(self, image: np.ndarray) -> dict:
        faces = self.app.get(image, max_num=0)
        if not faces:
            return {'face_detected': False, 'face_count': 0, 'embedding': None}

        # Use the largest face as the primary candidate for recognition.
        def area(face):
            bbox = getattr(face, 'bbox', None)
            if bbox is None or len(bbox) != 4:
                return 0.0
            return float(max(0.0, bbox[2] - bbox[0]) * max(0.0, bbox[3] - bbox[1]))

        primary = max(faces, key=area)
        embedding = getattr(primary, 'normed_embedding', None)
        if embedding is None:
            embedding = getattr(primary, 'embedding', None)

        return {
            'face_detected': True,
            'face_count': len(faces),
            'embedding': None if embedding is None else np.asarray(embedding, dtype=np.float32).tolist(),
        }
