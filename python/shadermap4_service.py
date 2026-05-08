"""
ShaderMap 4 Service - Professional shader and material node authoring
Handles shader graph generation and material creation
"""

import json
import os
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
SHADERMAP4_PORT = int(os.getenv('SHADERMAP4_SERVICE_PORT', 8012))
SHADERMAP4_WORK_DIR = Path(os.getenv('SHADERMAP4_WORK_DIR', './shadermap4_work'))
SHADERMAP4_WORK_DIR.mkdir(parents=True, exist_ok=True)

# Shader types
SHADER_TYPES = ['pbr', 'standard', 'custom', 'substance']
QUALITY_LEVELS = ['draft', 'standard', 'high', 'ultra']

# Shader templates
SHADER_TEMPLATES = {
    'pbr_metallic': {
        'name': 'PBR Metallic',
        'type': 'pbr',
        'category': 'pbr',
        'description': 'Physically-based metallic material',
    },
    'pbr_roughness': {
        'name': 'PBR Roughness',
        'type': 'pbr',
        'category': 'pbr',
        'description': 'Physically-based with roughness control',
    },
    'standard_diffuse': {
        'name': 'Standard Diffuse',
        'type': 'standard',
        'category': 'standard',
        'description': 'Simple diffuse shader',
    },
    'substance_advanced': {
        'name': 'Substance Advanced',
        'type': 'substance',
        'category': 'substance',
        'description': 'Advanced Substance Designer compatible',
    },
    'custom_nodes': {
        'name': 'Custom Nodes',
        'type': 'custom',
        'category': 'custom',
        'description': 'Fully customizable node graph',
    },
}


class ShaderGenerator:
    """Generates shader graphs and materials"""

    def __init__(self, work_dir: Path = SHADERMAP4_WORK_DIR):
        self.work_dir = work_dir
        self.work_dir.mkdir(parents=True, exist_ok=True)

    def generate_shaders(
        self,
        image_data: bytes,
        shader_type: str = 'pbr',
        quality: str = 'high',
        template: Optional[str] = None,
    ) -> Dict:
        """Generate shader from input image"""
        try:
            # Validate inputs
            if shader_type not in SHADER_TYPES:
                raise ValueError(f"Invalid shader type: {shader_type}")
            if quality not in QUALITY_LEVELS:
                raise ValueError(f"Invalid quality: {quality}")

            # Load image
            image = Image.open(io.BytesIO(image_data))

            # Generate shader ID
            shader_id = str(uuid.uuid4())[:8]

            # Generate based on type
            shaders = []
            if shader_type == 'pbr':
                shaders = self._generate_pbr_shader(image, shader_id, quality, template)
            elif shader_type == 'standard':
                shaders = self._generate_standard_shader(image, shader_id, quality)
            elif shader_type == 'substance':
                shaders = self._generate_substance_shader(image, shader_id, quality)
            elif shader_type == 'custom':
                shaders = self._generate_custom_shader(image, shader_id, quality)

            return {
                'id': shader_id,
                'shaders': shaders,
                'type': shader_type,
                'quality': quality,
                'template': template,
            }
        except Exception as e:
            logger.error(f"Error generating shaders: {e}")
            raise

    def _generate_pbr_shader(self, image: Image.Image, shader_id: str, quality: str, template: Optional[str]) -> List[Dict]:
        """Generate PBR shader graph"""
        shaders = []

        # Create shader node graph (simplified)
        node_graph = {
            'nodes': [
                {'id': 'input', 'type': 'TextureInput', 'props': {'texture': 'diffuse'}},
                {'id': 'normal_sampler', 'type': 'TextureSampler', 'props': {'texture': 'normal'}},
                {'id': 'principled_bsdf', 'type': 'PrincipledBSDF', 'props': {}},
                {'id': 'output', 'type': 'MaterialOutput', 'props': {}},
            ],
            'connections': [
                ('input', 'Color', 'principled_bsdf', 'Base Color'),
                ('normal_sampler', 'Color', 'principled_bsdf', 'Normal'),
                ('principled_bsdf', 'BSDF', 'output', 'Surface'),
            ],
        }

        shader_data = {
            'id': shader_id,
            'name': f'PBR_Shader_{shader_id}',
            'type': 'pbr',
            'quality': quality,
            'node_graph': node_graph,
            'format': 'sm4',  # ShaderMap 4 format
        }

        # Save shader file
        shader_file = self.work_dir / f"{shader_id}_pbr.json"
        with open(shader_file, 'w') as f:
            json.dump(shader_data, f, indent=2)

        # Generate preview
        preview_path = self._generate_preview(image, shader_id, 'pbr')

        shaders.append({
            'id': shader_id,
            'name': f'PBR_Shader_{shader_id}',
            'type': 'pbr',
            'quality': quality,
            'size': shader_file.stat().st_size,
            'generated_at': datetime.now().isoformat(),
            'preview': preview_path,
        })

        return shaders

    def _generate_standard_shader(self, image: Image.Image, shader_id: str, quality: str) -> List[Dict]:
        """Generate standard shader"""
        node_graph = {
            'nodes': [
                {'id': 'texture', 'type': 'TextureInput'},
                {'id': 'bsdf', 'type': 'DiffuseBSDF'},
                {'id': 'output', 'type': 'Output'},
            ],
            'connections': [
                ('texture', 'output', 'bsdf', 'Color'),
                ('bsdf', 'output', 'output', 'Surface'),
            ],
        }

        shader_data = {
            'id': shader_id,
            'name': f'Standard_Shader_{shader_id}',
            'type': 'standard',
            'quality': quality,
            'node_graph': node_graph,
            'format': 'sm4',
        }

        shader_file = self.work_dir / f"{shader_id}_standard.json"
        with open(shader_file, 'w') as f:
            json.dump(shader_data, f, indent=2)

        preview_path = self._generate_preview(image, shader_id, 'standard')

        return [{
            'id': shader_id,
            'name': f'Standard_Shader_{shader_id}',
            'type': 'standard',
            'quality': quality,
            'size': shader_file.stat().st_size,
            'generated_at': datetime.now().isoformat(),
            'preview': preview_path,
        }]

    def _generate_substance_shader(self, image: Image.Image, shader_id: str, quality: str) -> List[Dict]:
        """Generate Substance Designer compatible shader"""
        # Substance uses similar PBR but with specific node types
        node_graph = {
            'nodes': [
                {'id': 'input', 'type': 'TextureInput'},
                {'id': 'decompose', 'type': 'Decompose'},
                {'id': 'to_color', 'type': 'ToColor'},
                {'id': 'output', 'type': 'GraphOutput'},
            ],
            'connections': [
                ('input', 'output', 'decompose', 'input'),
                ('decompose', 'output', 'to_color', 'input'),
                ('to_color', 'output', 'output', 'input'),
            ],
        }

        shader_data = {
            'id': shader_id,
            'name': f'Substance_Shader_{shader_id}',
            'type': 'substance',
            'quality': quality,
            'node_graph': node_graph,
            'format': 'sbsar',  # Substance format
        }

        shader_file = self.work_dir / f"{shader_id}_substance.json"
        with open(shader_file, 'w') as f:
            json.dump(shader_data, f, indent=2)

        preview_path = self._generate_preview(image, shader_id, 'substance')

        return [{
            'id': shader_id,
            'name': f'Substance_Shader_{shader_id}',
            'type': 'substance',
            'quality': quality,
            'size': shader_file.stat().st_size,
            'generated_at': datetime.now().isoformat(),
            'preview': preview_path,
        }]

    def _generate_custom_shader(self, image: Image.Image, shader_id: str, quality: str) -> List[Dict]:
        """Generate fully custom shader graph"""
        node_graph = {
            'nodes': [
                {'id': 'input1', 'type': 'NodeInput', 'props': {'name': 'Color'}},
                {'id': 'input2', 'type': 'NodeInput', 'props': {'name': 'Normal'}},
                {'id': 'custom_op', 'type': 'CustomOperation', 'props': {}},
                {'id': 'output', 'type': 'NodeOutput'},
            ],
            'connections': [
                ('input1', 'output', 'custom_op', 'input1'),
                ('input2', 'output', 'custom_op', 'input2'),
                ('custom_op', 'output', 'output', 'result'),
            ],
        }

        shader_data = {
            'id': shader_id,
            'name': f'Custom_Shader_{shader_id}',
            'type': 'custom',
            'quality': quality,
            'node_graph': node_graph,
            'format': 'custom',
            'editable': True,
        }

        shader_file = self.work_dir / f"{shader_id}_custom.json"
        with open(shader_file, 'w') as f:
            json.dump(shader_data, f, indent=2)

        preview_path = self._generate_preview(image, shader_id, 'custom')

        return [{
            'id': shader_id,
            'name': f'Custom_Shader_{shader_id}',
            'type': 'custom',
            'quality': quality,
            'size': shader_file.stat().st_size,
            'generated_at': datetime.now().isoformat(),
            'preview': preview_path,
        }]

    def _generate_preview(self, image: Image.Image, shader_id: str, shader_type: str) -> str:
        """Generate shader preview image"""
        try:
            # Resize to preview size
            preview = image.copy()
            preview.thumbnail((256, 256))

            # Save preview
            preview_path = self.work_dir / f"{shader_id}_{shader_type}_preview.png"
            preview.save(preview_path)

            return f"/api/shadermap4/preview/{preview_path.name}"
        except Exception as e:
            logger.error(f"Error generating preview: {e}")
            return ""


# Initialize generator
generator = ShaderGenerator()


@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'service': 'shadermap4',
        'work_dir': str(SHADERMAP4_WORK_DIR),
    })


@app.route('/api/shadermap4/generate', methods=['POST'])
def generate():
    """Generate shaders from input image"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        shader_type = request.form.get('type', 'pbr')
        quality = request.form.get('quality', 'high')
        template = request.form.get('template')

        image_data = file.read()
        image = Image.open(io.BytesIO(image_data))

        result = generator.generate_shaders(image_data, shader_type, quality, template)

        return jsonify({
            'success': True,
            'shaders': result['shaders'],
            'id': result['id'],
        })
    except Exception as e:
        logger.error(f"Error in generate: {e}")
        return jsonify({'error': str(e)}), 400


@app.route('/api/shadermap4/templates', methods=['GET'])
def get_templates():
    """Get available shader templates"""
    templates = [{'id': k, **v} for k, v in SHADER_TEMPLATES.items()]
    return jsonify({'templates': templates})


@app.route('/api/shadermap4/download/<shader_id>', methods=['GET'])
def download_shader(shader_id: str):
    """Download a shader"""
    try:
        # Find shader file
        shader_files = list(SHADERMAP4_WORK_DIR.glob(f"{shader_id}*.json"))
        if not shader_files:
            return jsonify({'error': 'Shader not found'}), 404

        shader_file = shader_files[0]

        # Create ZIP with shader and preview
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zf:
            zf.write(shader_file, arcname=shader_file.name)

            # Add preview if exists
            preview_files = list(SHADERMAP4_WORK_DIR.glob(f"{shader_id}*_preview.png"))
            if preview_files:
                zf.write(preview_files[0], arcname=preview_files[0].name)

        zip_buffer.seek(0)
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'shader_{shader_id}.zip',
        )
    except Exception as e:
        logger.error(f"Error downloading: {e}")
        return jsonify({'error': str(e)}), 400


@app.route('/api/shadermap4/download-all', methods=['GET'])
def download_all():
    """Download all shaders as ZIP"""
    try:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zf:
            for file in SHADERMAP4_WORK_DIR.glob('*.json'):
                zf.write(file, arcname=file.name)

        zip_buffer.seek(0)
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'shaders_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip',
        )
    except Exception as e:
        logger.error(f"Error downloading all: {e}")
        return jsonify({'error': str(e)}), 400


@app.route('/api/shadermap4/preview/<filename>', methods=['GET'])
def get_preview(filename: str):
    """Get shader preview image"""
    try:
        preview_file = SHADERMAP4_WORK_DIR / filename
        if not preview_file.exists():
            return jsonify({'error': 'Preview not found'}), 404

        return send_file(preview_file, mimetype='image/png')
    except Exception as e:
        logger.error(f"Error getting preview: {e}")
        return jsonify({'error': str(e)}), 400


def run_service():
    """Run ShaderMap4 service"""
    logger.info(f"Starting ShaderMap4 Service on port {SHADERMAP4_PORT}")
    app.run(host='127.0.0.1', port=SHADERMAP4_PORT, debug=False)


if __name__ == '__main__':
    run_service()
