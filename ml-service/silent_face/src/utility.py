from dataclasses import dataclass


def parse_model_name(model_name):
    parts = model_name.split('_')
    info = parts[:-1]
    size = info[-1]
    h_input, w_input = size.split('x')
    model_type = model_name.split('.pth')[0].split('_')[-1]
    scale = None if info[0] == 'org' else float(info[0])
    return int(h_input), int(w_input), model_type, scale


def get_kernel(height, width):
    return ((height + 15) // 16, (width + 15) // 16)


@dataclass
class _CropResult:
    image: object


class DummyUtility:
    pass