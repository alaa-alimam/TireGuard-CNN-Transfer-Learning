# TireGuard — AI Tire Quality Classification

TireGuard is an AI-powered web application that classifies tire images into two categories: **Defective** and **Good**.

Built using transfer learning with MobileNetV1, TensorFlow/Keras, and FastAPI, the project provides an interactive web interface for uploading tire images and receiving model predictions with confidence scores.

## Features

- Upload tire images in JPG, JPEG, PNG, and WEBP formats.
- Preview images before classification.
- Classify tire images using a trained deep learning model.
- Display the predicted class and confidence score.
- Visualize the predicted probabilities for both classes.
- Responsive web interface for desktop and mobile devices.
- REST API for image prediction.
- Health-check endpoint to verify model availability.

## Tech Stack

- **Language:** Python
- **Deep Learning:** TensorFlow / Keras
- **Model Architecture:** MobileNetV1
- **Backend:** FastAPI, Uvicorn
- **Frontend:** HTML, CSS, JavaScript
- **Image Processing:** Pillow, NumPy

## Project Structure

```text
TireGuard/
├── notebook/
│   └── TireGuard_CNN.ipynb
├── model/
│   └── TIREGUARD___MobileNet_best.keras
├── api/
│   └── app.py
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── requirements.txt
└── README.md
```

## Installation and Setup

### 1. Clone the Repository

Replace `YOUR_REPOSITORY_URL` with your actual GitHub repository URL.

```bash
git clone YOUR_REPOSITORY_URL
cd TireGuard
```

### 2. Create a Virtual Environment

```bash
python -m venv .venv
```

Activate the environment on Windows:

```powershell
.\.venv\Scripts\Activate.ps1
```

### 3. Install Dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Add the Trained Model

Place the trained model in the following location:

```text
model/TIREGUARD___MobileNet_best.keras
```

Make sure the filename matches the model path configured in `api/app.py`.

### 5. Verify the Class Order

During model training, check the class order:

```python
print(train_ds.class_names)
```

The order must match the `CLASS_NAMES` variable in `api/app.py`.

The current API configuration assumes:

```python
CLASS_NAMES = ["defective", "good"]
```

For a binary classifier with a single sigmoid output, verify that the model's output represents the probability of the second class (`good`) before interpreting the predictions.

### 6. Run the Application

Run the following command from the project root:

```bash
python -m uvicorn api.app:app --reload --host 127.0.0.1 --port 8000
```

Open the application in your browser:

- **Web Application:** http://127.0.0.1:8000/
- **API Documentation:** http://127.0.0.1:8000/docs
- **Health Check:** http://127.0.0.1:8000/api/health

## API Endpoints

### Health Check

`GET /api/health`

Returns the API status, model availability, and expected image dimensions.

### Predict Tire Quality

`POST /api/predict`

Accepts an image using `multipart/form-data` with the field name `image`.

Supported formats depend on the image decoder and validation implemented by the API.

**Example Response**

```json
{
  "prediction": "good",
  "label": "Good tire",
  "confidence": 93.25,
  "probabilities": {
    "defective": 6.75,
    "good": 93.25
  }
}
```

The values above are illustrative and do not represent a prediction for a specific image.

## Model Configuration

| Configuration | Value |
|---|---|
| Architecture | MobileNetV1 |
| Input Shape | 224 × 224 × 3 |
| Output Layer | Sigmoid |
| Task | Binary Image Classification |
| Loss Function | Binary Cross-Entropy |
| Optimizer | Adam |
| Framework | TensorFlow / Keras |

The trained model includes a rescaling layer that converts pixel values from `[0, 255]` to `[-1, 1]`. The API passes image pixel values in the `[0, 255]` range to avoid applying normalization twice.

## Model Performance

The model was evaluated on a test set of 188 images.

| Metric | Score |
|---|---:|
| Test Accuracy | 95.74% |
| Macro Precision | 95.70% |
| Macro Recall | 95.70% |
| Macro F1-score | 95.70% |
| Test Loss | 0.1325 |

### Classification Report

| Class | Precision | Recall | F1-score | Support |
|---|---:|---:|---:|---:|
| Defective | 96.15% | 96.15% | 96.15% | 104 |
| Good | 95.24% | 95.24% | 95.24% | 84 |
| **Overall Accuracy** | — | — | **95.74%** | **188** |

*Note: The reported metrics reflect evaluation on the available test set. Performance on unseen, real-world images may differ.*

## Important Notes

- Confidence scores represent the model's estimated probabilities, not guaranteed accuracy.
- Performance may vary with lighting, image quality, tire type, camera angle, and real-world conditions.
- This project is an educational AI demonstration and is not a certified tire safety inspection system.
- Tires showing damage or suspected safety issues should be inspected by a qualified professional.

## Author

**Alaa Ahmed Mahmoud Abdelimam**

AI Engineer | Machine Learning | Deep Learning | Computer Vision