
import os
import logging
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path

import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tireguard")

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

MODEL_PATH = Path(
    os.getenv(
        "TIREGUARD_MODEL_PATH",
        str(BASE_DIR / "model" / "TIREGUARD___MobileNet_best.keras"),
    )
)

IMG_HEIGHT = 224
IMG_WIDTH = 224
MAX_CONTENT_LENGTH = 10 * 1024 * 1024

# Must match the training class order.
CLASS_NAMES = ["defective", "good"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not MODEL_PATH.is_file():
        raise RuntimeError(f"Model not found: {MODEL_PATH}")

    logger.info("Loading model: %s", MODEL_PATH)
    app.state.model = tf.keras.models.load_model(MODEL_PATH)
    logger.info("TireGuard model loaded successfully.")

    yield

    app.state.model = None
    logger.info("TireGuard model unloaded.")


app = FastAPI(
    title="TireGuard API",
    description="AI Tire Quality Classification",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Serve CSS and JavaScript from the frontend folder.
app.mount(
    "/static",
    StaticFiles(directory=str(FRONTEND_DIR)),
    name="static",
)


@app.get("/")
async def home():
    index_path = FRONTEND_DIR / "index.html"

    if not index_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="frontend/index.html not found.",
        )

    return FileResponse(index_path)


@app.get("/api/health")
async def health():
    model_loaded = getattr(app.state, "model", None) is not None

    return {
        "status": "ok" if model_loaded else "not_ready",
        "model_exists": MODEL_PATH.is_file(),
        "model_loaded": model_loaded,
        "image_size": [IMG_HEIGHT, IMG_WIDTH],
    }


@app.post("/api/predict")
async def predict(image: UploadFile = File(...)):
    if not image.filename:
        raise HTTPException(
            status_code=400,
            detail="No image selected.",
        )

    try:
        contents = await image.read(MAX_CONTENT_LENGTH + 1)
    finally:
        await image.close()

    if len(contents) > MAX_CONTENT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail="Maximum image size is 10 MB.",
        )

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    try:
        def preprocess():
            with Image.open(BytesIO(contents)) as img:
                img = img.convert("RGB")
                img = img.resize(
                    (IMG_WIDTH, IMG_HEIGHT),
                    Image.Resampling.BILINEAR,
                )
                return np.asarray(img, dtype=np.float32)

        image_array = await run_in_threadpool(preprocess)

    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise HTTPException(
            status_code=400,
            detail="Invalid image file.",
        ) from error

    image_array = np.expand_dims(image_array, axis=0)

    loaded_model = getattr(app.state, "model", None)

    if loaded_model is None:
        raise HTTPException(
            status_code=503,
            detail="Model is not loaded.",
        )

    try:
        def predict_image():
            return loaded_model.predict(image_array, verbose=0)

        raw_output = await run_in_threadpool(predict_image)
        values = np.asarray(raw_output).reshape(-1)

        if values.size != 1:
            raise ValueError(
                f"Expected one sigmoid output, received {values.size}."
            )

        output = float(values[0])

        if not np.isfinite(output) or not 0 <= output <= 1:
            raise ValueError("Invalid prediction probability.")

    except Exception as error:
        logger.exception("Prediction failed")
        raise HTTPException(
            status_code=500,
            detail="Prediction failed. Check the model output and logs.",
        ) from error

    # Assumption: sigmoid output is the probability of class index 1 (good).
    good_probability = output
    defective_probability = 1.0 - output

    class_index = 1 if good_probability >= 0.5 else 0
    predicted_class = CLASS_NAMES[class_index]
    confidence = max(good_probability, defective_probability)

    return {
        "prediction": predicted_class,
        "label": (
            "Good tire"
            if predicted_class == "good"
            else "Defective tire"
        ),
        "confidence": round(confidence * 100, 2),
        "probabilities": {
            "defective": round(defective_probability * 100, 2),
            "good": round(good_probability * 100, 2),
        },
    }
