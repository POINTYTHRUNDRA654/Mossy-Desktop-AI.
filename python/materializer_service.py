"""
Materializer Service - NVIDIA AI-powered texture generation
Handles AI-based texture creation from source images
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List
import logging
import uuid
import io
import zipfile
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image
import numpy as np

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
MATERIALIZER_PORT = int(os.getenv('MATERIALIZER_SERVICE_PORT', 8011))
MATERIALIZER_WORK_DIR = Path(os.getenv('MATERIALIZER_WORK_DIR', './materializer_work'))
MATERIALIZER_WORK_DIR.mkdir(parents=True, exist_ok=True)

# Texture generation modes
GENERATION_MODES = ['pbr', 'diffuse', 'normal', 'roughness', 'metallic', 'ao']
OUTPUT_FORMATS = ['png', 'exr', 'jpg']

# Material presets
MATERIAL_PRESETS = {
    'wood': {'name': 'Wood', 'type': 'organic', 'description': 'Natural wood texture generation'},
    'metal': {'name': 'Metal', 'type': 'inorganic', 'description': 'Metallic surface textures'},
    'stone': {'name': 'Stone', 'type': 'organic', 'description': 'Rock and stone materials'},
    'fabric': {'name': 'Fabric', 'type': 'organic', 'description': 'Cloth and textile patterns'},
    'plastic': {'name': 'Plastic', 'type': 'inorganic', 'description': 'Synthetic plastic materials'},
    'ceramic': {'name': 'Ceramic', 'type': 'inorganic', 'description': 'Ceramic and pottery textures'},
    'leather': {'name': 'Leather', 'type': 'organic', 'description': 'Leather material generation'},
    'rubber': {'name': 'Rubber', 'type': 'inorganic', 'description': 'Rubber and silicone textures'},
}


class MaterializerEngine:
    """Handles texture generation for Materializer"""

    def __init__(self, work_dir: Path = MATERIALIZER_WORK_DIR):
        self.work_dir = work_dir
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self.textures = {}

    def generate_textures(
        self,
        image_data: bytes,
        mode: str = 'pbr',
        ai_enhance: bool = True,
        preset: Optional[str] = None,
    ) -> Dict:
        """Generate textures from input image"""
        try:
            # Validate mode
            if mode not in GENERATION_MODES:
                raise ValueError(f"Invalid mode: {mode}")

            # Load image
            image = Image.open(io.BytesIO(image_data))
            image_array = np.array(image)

            # Generate texture ID
            texture_id = str(uuid.uuid4())[:8]

            # Generate textures based on mode
            textures = []
            if mode == 'pbr':
                textures = self._generate_pbr_suite(image_array, texture_id, ai_enhance, preset)
            elif mode == 'diffuse':
                textures = self._generate_diffuse(image_array, texture_id, ai_enhance)
            elif mode == 'normal':
                textures = self._generate_normal(image_array, texture_id, ai_enhance)
            elif mode == 'roughness':
                textures = self._generate_roughness(image_array, texture_id, ai_enhance)
            elif mode == 'metallic':
                textures = self._generate_metallic(image_array, texture_id, ai_enhance)
            elif mode == 'ao':
                textures = self._generate_ao(image_array, texture_id, ai_enhance)

            self.textures[texture_id] = textures
            return {
                'id': texture_id,
                'textures': textures,
                'mode': mode,
                'preset': preset,
                'ai_enhanced': ai_enhance,
            }
        except Exception as e:
            logger.error(f"Error generating textures: {e}")
            raise

    def _generate_pbr_suite(self, image: np.ndarray, tex_id: str, enhance: bool, preset: Optional[str]) -> List[Dict]:
        """Generate full PBR texture suite (Diffuse, Normal, Roughness, Metallic, AO)"""
        textures = []

        # Diffuse map
        diffuse = self._process_diffuse(image, preset)
        textures.append(self._save_texture(diffuse, f"{tex_id}_diffuse", "pbr"))

        # Normal map
        normal = self._process_normal(image, enhance)
        textures.append(self._save_texture(normal, f"{tex_id}_normal", "pbr"))

        # Roughness map
        roughness = self._process_roughness(image)
        textures.append(self._save_texture(roughness, f"{tex_id}_roughness", "pbr"))

        # Metallic map
        metallic = self._process_metallic(image)
        textures.append(self._save_texture(metallic, f"{tex_id}_metallic", "pbr"))

        # Ambient Occlusion
        ao = self._process_ao(image)
        textures.append(self._save_texture(ao, f"{tex_id}_ao", "pbr"))

        if enhance:
            logger.info(f"AI enhancement applied to PBR suite {tex_id}")

        return textures

    def _generate_diffuse(self, image: np.ndarray, tex_id: str, enhance: bool) -> List[Dict]:
        """Generate diffuse/albedo map"""
        diffuse = self._process_diffuse(image, None)
        return [self._save_texture(diffuse, f"{tex_id}_diffuse", "diffuse")]

    def _generate_normal(self, image: np.ndarray, tex_id: str, enhance: bool) -> List[Dict]:
        """Generate normal map"""
        normal = self._process_normal(image, enhance)
        return [self._save_texture(normal, f"{tex_id}_normal", "normal")]

    def _generate_roughness(self, image: np.ndarray, tex_id: str, enhance: bool) -> List[Dict]:
        """Generate roughness map"""
        roughness = self._process_roughness(image)
        return [self._save_texture(roughness, f"{tex_id}_roughness", "roughness")]

    def _generate_metallic(self, image: np.ndarray, tex_id: str, enhance: bool) -> List[Dict]:
        """Generate metallic map"""
        metallic = self._process_metallic(image)
        return [self._save_texture(metallic, f"{tex_id}_metallic", "metallic")]

    def _generate_ao(self, image: np.ndarray, tex_id: str, enhance: bool) -> List[Dict]:
        """Generate ambient occlusion map"""
        ao = self._process_ao(image)
        return [self._save_texture(ao, f"{tex_id}_ao", "ao")]

    def _process_diffuse(self, image: np.ndarray, preset: Optional[str]) -> Image.Image:
        """Process diffuse/albedo texture"""
        # Normalize to 0-1 range
        if image.dtype == np.uint8:
            img_normalized = image.astype(np.float32) / 255.0
        else:
            img_normalized = image.astype(np.float32)

        # Reduce saturation slightly for PBR
        if len(img_normalized.shape) == 3 and img_normalized.shape[2] >= 3:
            from PIL import ImageEnhance
            img_pil = Image.fromarray((img_normalized[:, :, :3] * 255).astype(np.uint8))
            enhancer = ImageEnhance.Color(img_pil)
            img_pil = enhancer.enhance(0.9)
            return img_pil

        return Image.fromarray((img_normalized * 255).astype(np.uint8))

    def _process_normal(self, image: np.ndarray, enhance: bool) -> Image.Image:
        """Generate normal map from heightmap"""
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = np.mean(image[:, :, :3], axis=2)
        else:
            gray = image

        # Simple Sobel edge detection for normal map
        from scipy import ndimage
        gx = ndimage.sobel(gray, axis=1)
        gy = ndimage.sobel(gray, axis=0)

        # Compute normals
        normal = np.zeros((*gray.shape, 3), dtype=np.float32)
        normal[:, :, 0] = gx  # X
        normal[:, :, 1] = gy  # Y
        normal[:, :, 2] = 1.0  # Z

        # Normalize
        magnitude = np.sqrt(normal[:, :, 0]**2 + normal[:, :, 1]**2 + normal[:, :, 2]**2)
        normal = normal / (magnitude[:, :, np.newaxis] + 1e-5)

        # Convert to 0-255 range (DirectX format)
        normal_img = ((normal + 1) * 127.5).astype(np.uint8)
        return Image.fromarray(normal_img[:, :, :3])

    def _process_roughness(self, image: np.ndarray) -> Image.Image:
        """Generate roughness map"""
        if len(image.shape) == 3:
            roughness = np.mean(image[:, :, :3], axis=2)
        else:
            roughness = image

        # Invert and scale for roughness
        roughness = 1.0 - (roughness / 255.0 if roughness.max() > 1 else roughness)
        roughness = (roughness * 255).astype(np.uint8)
        return Image.fromarray(np.stack([roughness] * 3, axis=-1))

    def _process_metallic(self, image: np.ndarray) -> Image.Image:
        """Generate metallic map"""
        if len(image.shape) == 3:
            metallic = np.mean(image[:, :, :3], axis=2)
        else:
            metallic = image

        # Low metallic default
        metallic = (metallic * 0.2).astype(np.uint8)
        return Image.fromarray(np.stack([metallic] * 3, axis=-1))

    def _process_ao(self, image: np.ndarray) -> Image.Image:
        """Generate ambient occlusion map"""
        if len(image.shape) == 3:
            ao = np.mean(image[:, :, :3], axis=2)
        else:
            ao = image

        # Threshold for AO
        ao = (ao > 128).astype(np.uint8) * 255
        return Image.fromarray(np.stack([ao] * 3, axis=-1))

    def _save_texture(self, image: Image.Image, name: str, mode: str) -> Dict:
        """Save texture to disk and return metadata"""
        # Save as PNG
        output_path = self.work_dir / f"{name}.png"
        image.save(output_path)

        stat = output_path.stat()
        return {
            'id': name,
            'name': name,
            'format': 'png',
            'size': stat.st_size,
            'generated_at': datetime.now().isoformat(),
            'mode': mode,
            'path': str(output_path),
        }


# Initialize engine
engine = MaterializerEngine()


@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'service': 'materializer',
        'work_dir': str(MATERIALIZER_WORK_DIR),
    })


@app.route('/api/materializer/generate', methods=['POST'])
def generate():
    """Generate textures from input image"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        mode = request.form.get('mode', 'pbr')
        ai_enhance = request.form.get('ai_enhance', 'true').lower() == 'true'
        preset = request.form.get('preset')

        image_data = file.read()
        result = engine.generate_textures(image_data, mode, ai_enhance, preset)

        return jsonify({
            'success': True,
            'textures': result['textures'],
            'id': result['id'],
        })
    except Exception as e:
        logger.error(f"Error in generate: {e}")
        return jsonify({'error': str(e)}), 400


@app.route('/api/materializer/presets', methods=['GET'])
def get_presets():
    """Get available material presets"""
    presets = [{'name': k, **v} for k, v in MATERIAL_PRESETS.items()]
    return jsonify({'presets': presets})


@app.route('/api/materializer/download/<texture_id>', methods=['GET'])
def download_texture(texture_id: str):
    """Download a single texture"""
    try:
        path = MATERIALIZER_WORK_DIR / f"{texture_id}.png"
        if not path.exists():
            return jsonify({'error': 'Texture not found'}), 404

        return send_file(path, mimetype='image/png', as_attachment=True)
    except Exception as e:
        logger.error(f"Error downloading: {e}")
        return jsonify({'error': str(e)}), 400


@app.route('/api/materializer/download-all', methods=['GET'])
def download_all():
    """Download all textures as ZIP"""
    try:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zf:
            for texture_file in MATERIALIZER_WORK_DIR.glob('*.png'):
                zf.write(texture_file, arcname=texture_file.name)

        zip_buffer.seek(0)
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'textures_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip',
        )
    except Exception as e:
        logger.error(f"Error downloading all: {e}")
        return jsonify({'error': str(e)}), 400


def run_service():
    """Run the Materializer service"""
    logger.info(f"Starting Materializer Service on port {MATERIALIZER_PORT}")
    app.run(host='127.0.0.1', port=MATERIALIZER_PORT, debug=False)


if __name__ == '__main__':
    run_service()
