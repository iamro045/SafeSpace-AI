import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="NudeNet nudity detection wrapper")
    parser.add_argument("--image", required=True, help="Path to a local image file")
    parser.add_argument("--model", required=False, help="Optional path to a NudeNet ONNX model")
    parser.add_argument(
        "--resolution",
        required=False,
        type=int,
        default=320,
        help="Inference resolution (default: 320)",
    )
    args = parser.parse_args()

    try:
        from nudenet import NudeDetector
    except Exception as e:
        sys.stderr.write('Failed to import nudenet. Install with: pip install --upgrade "nudenet>=3.4.2"\n')
        sys.stderr.write(str(e) + "\n")
        return 2

    try:
        detector = NudeDetector(model_path=args.model, inference_resolution=args.resolution)
        detections = detector.detect(args.image)
        # detections looks like: [{"class": "FEMALE_BREAST_EXPOSED", "score": 0.79, "box": [x,y,w,h]}, ...]
        sys.stdout.write(json.dumps({"detections": detections}))
        return 0
    except Exception as e:
        sys.stderr.write(str(e) + "\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
