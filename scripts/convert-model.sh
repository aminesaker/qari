#!/usr/bin/env bash
# Reproduit la conversion du modèle Tarteel (Apache-2.0) au format whisper.cpp.
# Résultat : assets/models/ggml-quran-base-q5_0.bin (~55 Mo)
set -euo pipefail
WORK=${1:-/tmp/qari-model}
mkdir -p "$WORK" && cd "$WORK"
pip install torch transformers huggingface_hub --quiet
[ -d whisper.cpp ] || git clone --depth 1 https://github.com/ggml-org/whisper.cpp
[ -d openai-whisper ] || git clone --depth 1 https://github.com/openai/whisper openai-whisper
python3 -c "from huggingface_hub import snapshot_download; snapshot_download('tarteel-ai/whisper-base-ar-quran', local_dir='whisper-base-ar-quran')"
# Le config publié indique max_length=1024 alors que le décodeur a 448 positions.
sed -i 's/"max_length": 1024/"max_length": 448/' whisper-base-ar-quran/config.json
mkdir -p out
python3 whisper.cpp/models/convert-h5-to-ggml.py whisper-base-ar-quran openai-whisper out
(cd whisper.cpp && cmake -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j --target whisper-quantize)
whisper.cpp/build/bin/whisper-quantize out/ggml-model.bin out/ggml-quran-base-q5_0.bin q5_0
echo "OK -> $WORK/out/ggml-quran-base-q5_0.bin"
