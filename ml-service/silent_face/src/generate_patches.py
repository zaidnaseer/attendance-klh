import cv2


class CropImage:
    def crop(self, org_img, bbox, scale, out_w, out_h, crop=True):
        x, y, w, h = bbox
        if not crop:
            return cv2.resize(org_img, (out_w, out_h))
        pad_w = int(w * (scale or 1.0))
        pad_h = int(h * (scale or 1.0))
        x1 = max(x - (pad_w - w) // 2, 0)
        y1 = max(y - (pad_h - h) // 2, 0)
        x2 = min(x1 + pad_w, org_img.shape[1])
        y2 = min(y1 + pad_h, org_img.shape[0])
        crop_img = org_img[y1:y2, x1:x2]
        if crop_img.size == 0:
            crop_img = org_img
        return cv2.resize(crop_img, (out_w, out_h))