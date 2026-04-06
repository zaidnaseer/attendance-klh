import cv2
import numpy as np

from .utility import get_kernel, parse_model_name


class Detection:
    def __init__(self):
        self.detector_confidence = 0.6

    def get_bbox(self, img):
        height, width = img.shape[:2]
        return [0, 0, width, height]


class AntiSpoofPredict(Detection):
    def __init__(self, device_id):
        super().__init__()
        self.device_id = device_id

    def _load_model(self, model_path):
        return model_path

    def predict(self, img, model_path):
        self._load_model(model_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
        mean_intensity = float(np.mean(gray)) / 255.0
        fake_score = np.clip(1.0 - mean_intensity, 0.0, 1.0)
        real_score = 1.0 - fake_score
        return np.array([[fake_score, real_score, 0.0]], dtype=np.float32)