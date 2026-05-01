# Project Clean - Quick Start Guide

Project Clean is a local-first AI content moderation system. Follow these steps to set it up on your local machine (Windows or Linux).

## Prerequisites

### Basic requirements

**Required (for the web app)**

1. **Node.js**: v18+ (includes `npm`) from [nodejs.org](https://nodejs.org/).
2. **Git**: from [git-scm.com](https://git-scm.com/).

**Optional (only if you enable local Python-based image moderation)**

3. **Python**: 3.10+ from [python.org](https://python.org/).
4. **pip**: comes with Python; recommended usage is `python -m pip ...`.

**Optional (only if you enable video moderation)**

5. **FFmpeg**: required for video analysis (frame sampling). Install and make sure `ffmpeg` is available on your `PATH`.

Quick version checks:

```bash
node -v
npm -v
python --version
python -m pip --version
```

Recommended (optional) Python virtual environment:

```bash
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# Linux/macOS
source .venv/bin/activate
```

## Installation Steps (Windows & Linux)

1.  **Clone the Repository**:
    ```bash
    git clone <your-repository-url>
    cd project-clean
    ```

2.  **Install Dependencies**:
    Open your terminal (Command Prompt, PowerShell, or Bash) and run:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a file named `.env` in the root directory and add the following:
    ```env
    JWT_SECRET=your_super_secret_key_here
    PORT=5000
    # Optional upload limits (bytes)
    # MAX_IMAGE_BYTES=2097152
    # MAX_VIDEO_BYTES=262144000
    # MAX_DATASET_BYTES=52428800
    ```
    Notes:
    - The server uses **in-memory storage by default**, so no database is required for local/offline use (data resets on restart).
    - `PORT` is the preferred port, but if it's already in use the server will automatically try `PORT+1` up to `PORT+20`.

4.  **Start the Application**:
    ```bash
    npm run dev
    ```

5.  **Access the App**:
    Open the URL shown in the server logs.

    - If `PORT=5000` is free, use `http://localhost:5000`
    - If you see a log like `port 5000 in use; serving on port 5001`, use `http://localhost:5001`

## Demo Credentials

- **Admin**: `admin@projectclean.com` / `admin`
- **Moderator**: `moderator@projectclean.com` / `moderator`
- **User**: `user@projectclean.com` / `user`

## Features & Usage

- **Social Demo**: Create posts (text/image/video). Content is analyzed automatically.
- **Content Review**: Moderation queue for flagged/blocked content, with audit/explainability details.
- **Analytics**: Dashboard analytics with export (CSV/PDF).
- **Settings**:
    - Upload text datasets (`.csv`, `.tsv`, `.txt`) and train the local text model.
    - Edit the abuse lexicon (block/review terms).
    - Export manual-review training data (CSV/PDF).

### Text dataset upload (training)

The trainer supports multiple common schemas, including:

- `text` + `label` (optional `language`)
- `text` + `hate_label` (`0/1`)
- `tweet` + `class` (`0/1/2`)
- `Post` + `Labels Set`

## Optional: Better NSFW Image Moderation

This project can optionally run a real NSFW classifier for uploaded images using the `nsfw_detector` package from the upstream repository:
https://github.com/GantMan/nsfw_model

1. Install Python 3.8+.
2. Install dependencies:
    ```bash
    pip install nsfw-detector tensorflow
    ```
3. Download a model file (example from the upstream README): `nsfw_mobilenet2.224x224.h5`
4. Set environment variables (for example in `.env`):
    ```env
    NSFW_ENABLED=true
    NSFW_MODEL_PATH=C:\\path\\to\\nsfw_mobilenet2.224x224.h5
    # Optional (if python isn't on PATH)
    NSFW_PYTHON=C:\\path\\to\\python.exe
    ```
## Optional: NudeNet Nudity Detection (More Detailed)

If you want more detailed nudity detection (body-part detections like `FEMALE_BREAST_EXPOSED`, `FEMALE_GENITALIA_EXPOSED`), you can enable **NudeNet**.

1) Install Python dependencies:
    ```bash
    pip install --upgrade "nudenet>=3.4.2"
    ```

2) Enable in your environment:
    ```env
    NUDENET_ENABLED=true
    # Optional (if python isn't on PATH)
    NUDENET_PYTHON=C:\\path\\to\\python.exe
    # Optional
    NUDENET_INFERENCE_RES=320
    # Optional (path to a downloaded NudeNet .onnx model; if omitted, NudeNet uses its bundled default model)
    NUDENET_MODEL_PATH=...
    ```

Notes:
When enabled and the image is a local upload (`/uploads/...`), the server prefers NudeNet results; if NudeNet is not available it falls back to the `nsfw_model` scoring and then to filename heuristics.

If not enabled, the server falls back to the existing filename-based image heuristics.

## Production build (optional)

Build and run the production bundle:

```bash
npm run build
npm start
```

## Common issues

- **Port already in use**: the server auto-selects the next free port and logs it. Open the logged URL.
- **Video analysis not working**: install FFmpeg and ensure `ffmpeg` is on `PATH`.
