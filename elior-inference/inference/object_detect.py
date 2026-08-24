import numpy as np
from collections import Counter
from huggingface_hub import hf_hub_download
from ultralytics import YOLO
from .utils import norm_bbox

_path  = hf_hub_download(repo_id="arkhangelos/elior-yolo", filename="yolov11n_coco_best.pt")
_model = YOLO(_path)

COCO_ID = {
    'person': 'orang', 'bicycle': 'sepeda', 'car': 'mobil',
    'motorcycle': 'sepeda motor', 'airplane': 'pesawat', 'bus': 'bus',
    'train': 'kereta api', 'truck': 'truk', 'boat': 'perahu',
    'traffic light': 'lampu lalu lintas', 'fire hydrant': 'hidran kebakaran',
    'stop sign': 'rambu berhenti', 'parking meter': 'meteran parkir',
    'bench': 'bangku', 'bird': 'burung', 'cat': 'kucing',
    'dog': 'anjing', 'horse': 'kuda', 'sheep': 'domba', 'cow': 'sapi',
    'elephant': 'gajah', 'bear': 'beruang', 'zebra': 'zebra',
    'giraffe': 'jerapah', 'backpack': 'ransel', 'umbrella': 'payung',
    'handbag': 'tas tangan', 'tie': 'dasi', 'suitcase': 'koper',
    'frisbee': 'frisbee', 'skis': 'ski', 'snowboard': 'papan salju',
    'sports ball': 'bola olahraga', 'kite': 'layang-layang',
    'baseball bat': 'tongkat bisbol', 'baseball glove': 'sarung tangan bisbol',
    'skateboard': 'skateboard', 'surfboard': 'papan selancar',
    'tennis racket': 'raket tenis', 'bottle': 'botol',
    'wine glass': 'gelas anggur', 'cup': 'cangkir', 'fork': 'garpu',
    'knife': 'pisau', 'spoon': 'sendok', 'bowl': 'mangkuk',
    'banana': 'pisang', 'apple': 'apel', 'sandwich': 'roti lapis',
    'orange': 'jeruk', 'broccoli': 'brokoli', 'carrot': 'wortel',
    'hot dog': 'sosis', 'pizza': 'pizza', 'donut': 'donat',
    'cake': 'kue', 'chair': 'kursi', 'couch': 'sofa',
    'potted plant': 'tanaman pot', 'bed': 'tempat tidur',
    'dining table': 'meja makan', 'toilet': 'toilet', 'tv': 'televisi',
    'laptop': 'laptop', 'mouse': 'tetikus', 'remote': 'remote',
    'keyboard': 'keyboard', 'cell phone': 'ponsel',
    'microwave': 'microwave', 'oven': 'oven',
    'toaster': 'pemanggang roti', 'sink': 'wastafel',
    'refrigerator': 'kulkas', 'book': 'buku', 'clock': 'jam',
    'vase': 'vas bunga', 'scissors': 'gunting',
    'teddy bear': 'boneka beruang', 'hair drier': 'pengering rambut',
    'toothbrush': 'sikat gigi',
}

CONF_OBJECT = 0.70

def build_labels_prompt(labels_en: list[str]) -> str:
    counts = Counter(COCO_ID.get(l, l) for l in labels_en)
    parts  = [f"{cnt} {obj}" if cnt > 1 else obj for obj, cnt in counts.items()]
    if len(parts) == 1:
        return parts[0]
    if len(parts) == 2:
        return f"{parts[0]} dan {parts[1]}"
    return ", ".join(parts[:-1]) + f", dan {parts[-1]}"


def predict(img: np.ndarray, scale: float, x_off: int, y_off: int,
            w_orig: int, h_orig: int) -> dict | None:
    results = _model(img, conf=CONF_OBJECT, verbose=False)
    boxes   = results[0].boxes

    if len(boxes) == 0:
        return None

    labels_en = [results[0].names[int(boxes.cls[i])] for i in range(len(boxes))]
    best_i    = int(boxes.conf.argmax())
    best_box  = boxes.xyxy[best_i].tolist()
    best_conf = float(boxes.conf[best_i])

    return {
        "labels_en":     labels_en,
        "labels_prompt": build_labels_prompt(labels_en),
        "confidence":    best_conf,
        "bbox":          norm_bbox(best_box, scale, x_off, y_off, w_orig, h_orig),
    }
