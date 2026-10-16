
"use strict";

const $ = (id) => document.getElementById(id);

const imageInput = $("imageInput");
const dropZone = $("dropZone");
const placeholder = $("placeholder");
const preview = $("preview");
const previewTag = $("previewTag");
const fileName = $("fileName");
const fileMeta = $("fileMeta");
const removeBtn = $("removeBtn");
const analyzeBtn = $("analyzeBtn");
const analyzeButtonText = $("analyzeButtonText");

const apiStatus = $("apiStatus");
const apiStatusText = $("apiStatusText");

const emptyResult = $("emptyResult");
const loadingResult = $("loadingResult");
const predictionResult = $("predictionResult");
const errorMessage = $("errorMessage");
const newAnalysisBtn = $("newAnalysisBtn");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

let selectedFile = null;
let previewUrl = null;
let isLoading = false;

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
}

function setApiStatus(state, message) {
  apiStatus.classList.remove("online", "offline");

  if (state === "online") {
    apiStatus.classList.add("online");
  } else if (state === "offline") {
    apiStatus.classList.add("offline");
  }

  apiStatusText.textContent = message;
}

async function checkApiHealth() {
  try {
    const response = await fetch("/api/health", {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("API unavailable");
    }

    setApiStatus("online", "API Connected");
  } catch {
    setApiStatus("offline", "API Offline");
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function selectFile(file) {
  if (!file || isLoading) return;

  clearError();

  if (!ALLOWED_TYPES.includes(file.type)) {
    showError("Please select a JPG, PNG, or WEBP image.");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showError("Image size must not exceed 10 MB.");
    return;
  }

  if (file.size === 0) {
    showError("The selected image is empty.");
    return;
  }

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  selectedFile = file;
  previewUrl = URL.createObjectURL(file);

  preview.src = previewUrl;
  preview.classList.remove("hidden");
  placeholder.classList.add("hidden");
  previewTag.classList.remove("hidden");

  fileName.textContent = file.name;
  fileMeta.textContent = `${formatFileSize(file.size)} · Ready for analysis`;

  removeBtn.classList.remove("hidden");
  analyzeBtn.disabled = false;

  emptyResult.classList.remove("hidden");
  loadingResult.classList.add("hidden");
  predictionResult.classList.add("hidden");

  imageInput.value = "";
}

function resetSelection() {
  if (isLoading) return;

  selectedFile = null;
  imageInput.value = "";

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  preview.removeAttribute("src");
  preview.classList.add("hidden");
  previewTag.classList.add("hidden");
  placeholder.classList.remove("hidden");

  fileName.textContent = "No image selected";
  fileMeta.textContent = "Your image details will appear here";

  removeBtn.classList.add("hidden");
  analyzeBtn.disabled = true;

  emptyResult.classList.remove("hidden");
  loadingResult.classList.add("hidden");
  predictionResult.classList.add("hidden");

  clearError();
}

function setLoading(loading) {
  isLoading = loading;
  analyzeBtn.disabled = loading || !selectedFile;
  removeBtn.disabled = loading;

  analyzeButtonText.textContent = loading
    ? "Analyzing..."
    : "Analyze tire";

  analyzeBtn.querySelector(".button-arrow").textContent =
    loading ? "…" : "↗";

  loadingResult.classList.toggle("hidden", !loading);

  if (loading) {
    emptyResult.classList.add("hidden");
    predictionResult.classList.add("hidden");
    clearError();
  }
}

function toPercentage(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error("The API returned an invalid probability.");
  }

  return Math.max(0, Math.min(100, number));
}

function renderResult(data) {
  if (
    !data ||
    !["good", "defective"].includes(data.prediction) ||
    !data.probabilities
  ) {
    throw new Error("The API returned an unexpected result format.");
  }

  const isGood = data.prediction === "good";
  const confidence = toPercentage(data.confidence);
  const goodProbability = toPercentage(data.probabilities.good);
  const defectiveProbability = toPercentage(data.probabilities.defective);

  $("resultLabel").textContent =
    data.label || (isGood ? "Good tire" : "Defective tire");

  $("resultSymbol").textContent = isGood ? "✓" : "!";

  const badge = $("resultBadge");
  badge.classList.toggle("defective", !isGood);
  badge.classList.toggle("good", isGood);

  $("resultStatusPill").textContent = isGood ? "GOOD" : "DEFECTIVE";

  $("confidenceValue").textContent = `${confidence.toFixed(2)}%`;

  const confidenceBar = $("confidenceBar");
  confidenceBar.style.width = `${confidence}%`;
  confidenceBar.classList.toggle("defective-fill", !isGood);

  $("goodProbability").textContent = `${goodProbability.toFixed(2)}%`;
  $("defectiveProbability").textContent =
    `${defectiveProbability.toFixed(2)}%`;

  $("goodBar").style.width = `${goodProbability}%`;
  $("defectiveBar").style.width = `${defectiveProbability}%`;

  emptyResult.classList.add("hidden");
  loadingResult.classList.add("hidden");
  predictionResult.classList.remove("hidden");

  clearError();
}

async function analyzeImage() {
  if (!selectedFile || isLoading) return;

  const formData = new FormData();

  // Must match the FastAPI endpoint parameter: image
  formData.append("image", selectedFile);

  setLoading(true);

  try {
    const response = await fetch("/api/predict", {
      method: "POST",
      body: formData
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = data.detail || data.error;
      const message = Array.isArray(detail)
        ? detail.map((item) => item.msg || "Invalid input").join(", ")
        : detail;

      throw new Error(
        message || `Analysis failed (HTTP ${response.status}).`
      );
    }

    renderResult(data);
  } catch (error) {
    predictionResult.classList.add("hidden");
    emptyResult.classList.add("hidden");

    showError(
      error.message ||
      "Unable to analyze the image. Please check your API connection."
    );
  } finally {
    setLoading(false);
  }
}

// Open the file picker.
dropZone.addEventListener("click", () => {
  if (!isLoading) imageInput.click();
});

// Select an image.
imageInput.addEventListener("change", (event) => {
  selectFile(event.target.files[0]);
});

// Remove the selected image.
removeBtn.addEventListener("click", resetSelection);

// Drag and drop support.
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();

    if (!isLoading) {
      dropZone.classList.add("dragging");
    }
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", (event) => {
  if (isLoading) return;

  const files = event.dataTransfer.files;
  selectFile(files[0]);
});

// Run AI inference.
analyzeBtn.addEventListener("click", analyzeImage);

// Start a new analysis.
newAnalysisBtn.addEventListener("click", () => {
  if (isLoading) return;

  resetSelection();
  $("imageInput").click();
});

// Initial API status check.
checkApiHealth();
