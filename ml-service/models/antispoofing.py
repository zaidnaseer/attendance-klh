import os
from glob import glob

import cv2
import numpy as np

from src.anti_spoof_predict import AntiSpoofPredict
from src.generate_patches import CropImage
from src.utility import parse_model_name


class AntiSpoofingEnsemble:
    def __init__(self, weights_dir: str):
        self.weights_dir = weights_dir
        self.model_paths = sorted(glob(os.path.join(weights_dir, '*.pth')))
        if not self.model_paths:
            raise RuntimeError(f'No anti-spoof weights found in {weights_dir}')

        v1_model = self._pick_model('MiniFASNetV1')
        v2_model = self._pick_model('MiniFASNetV2')
        if not v1_model:
            raise RuntimeError('Missing MiniFASNet V1 weight file in /app/weights')
        if not v2_model:
            raise RuntimeError('Missing MiniFASNet V2 weight file in /app/weights')

        self.model_paths = [v1_model, v2_model]
        self.predictor = AntiSpoofPredict(0)
        self.cropper = CropImage()

    def _pick_model(self, prefix: str) -> str | None:
        for model_path in self.model_paths:
            model_name = os.path.basename(model_path)
            if prefix in model_name:
                return model_path
        return None

    def score(self, image: np.ndarray) -> float:
        bbox = self.predictor.get_bbox(image)
        if bbox is None:
            return 1.0

        scores = []
        for model_path in self.model_paths:
            h_input, w_input, _model_type, scale = parse_model_name(os.path.basename(model_path))
            crop = self.cropper.crop(
                org_img=image,
                bbox=bbox,
                scale=scale,
                out_w=w_input,
                out_h=h_input,
                crop=scale is not None,
            )
            prediction = self.predictor.predict(crop, model_path)
            real_score = float(prediction[0][1]) if prediction.shape[1] > 1 else float(prediction[0][-1])
            scores.append(1.0 - real_score)

        return float(np.mean(scores)) if scores else 1.0
