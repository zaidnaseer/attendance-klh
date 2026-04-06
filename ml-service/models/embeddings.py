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
