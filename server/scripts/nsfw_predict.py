import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="NSFW image classification wrapper")
    parser.add_argument("--model", required=True, help="Path to nsfw_model .h5 file")
    parser.add_argument("--image", required=True, help="Path to a local image file")
    args = parser.parse_args()

    try:
        from nsfw_detector import predict
    except Exception as e:
        sys.stderr.write("Failed to import nsfw_detector. Install with: pip install nsfw-detector\n")
        sys.stderr.write(str(e) + "\n")
        return 2

    try:
        model = predict.load_model(args.model)
        res = predict.classify(model, args.image)
        # res looks like: {"/path/to/image.jpg": {"sexy":..., "neutral":..., "porn":..., "hentai":..., "drawings":...}}
        if isinstance(res, dict) and len(res) > 0:
            first_key = next(iter(res.keys()))
            scores = res.get(first_key, {})
        else:
            scores = {}
        sys.stdout.write(json.dumps({"scores": scores}))
        return 0
    except Exception as e:
        sys.stderr.write(str(e) + "\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
