# Backend: FastAPI + WhisperX alignment/diarization on the GPU.
# PyTorch cu128 wheels carry their own CUDA 12.8 runtime, cuBLAS and cuDNN, which
# have kernels for Blackwell GPUs (RTX 50xx); the host only needs the NVIDIA driver.
FROM python:3.13-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN pip install --no-cache-dir torch==2.8.* torchvision==0.23.* torchaudio==2.8.* \
      --index-url https://download.pytorch.org/whl/cu128
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
      --extra-index-url https://download.pytorch.org/whl/cu128

COPY . .
ENV DATA_DIR=/data HOST=0.0.0.0 PORT=8001 PYTHONUNBUFFERED=1
EXPOSE 8001
CMD ["python", "main.py"]
