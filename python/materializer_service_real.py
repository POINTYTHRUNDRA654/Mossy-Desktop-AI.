"""
NVIDIA Materializer Service Wrapper
Flask backend wrapping the actual NVIDIA Materializer executable
"""
import os
import json
import uuid
import subprocess
import logging
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
MATERIALIZER_PORT = int(os.getenv('MATERIALIZER_SERVICE_PORT', 8011))
MATERIALIZER_WORK_DIR = Path(os.getenv('MATERIALIZER_WORK_DIR', './materializer_work'))
MATERIALIZER_EXE = os.getenv('MATERIALIZER_EXE', 'F:\\Materialize_1.78\\Materialize.exe')

# Ensure work directory exists
MATERIALIZER_WORK_DIR.mkdir(parents=True, exist_ok=True)

# Material presets for UI hints
MATERIAL_PRESETS = {
    'wood': 'Natural wood texture generation',
    'metal': 'Metallic surfaces with proper reflectivity',
    'stone': 'Rock and stone materials with natural variation',
    'fabric': 'Cloth and textile patterns',
    'plastic': 'Synthetic plastic materials',
    'ceramic': 'Ceramic and pottery textures',
    'leather': 'Leather material generation',
    'rubber': 'Rubber and silicone textures',
}

# Generation modes supported
GENERATION_MODES = ['pbr', 'diffuse', 'normal', 'roughness', 'metallic', 'ao']

def _verify_materializer():
    """Check if Materializer executable exists"""
    if not os.path.exists(MATERIALIZER_EXE):
        logger.error(f"Materializer not found at {MATERIALIZER_EXE}")
        raise FileNotFoundError(f"Materializer not found at {MATERIALIZER_EXE}")
    logger.info(f"Materializer found at {MATERIALIZER_EXE}")
    return True

def _get_job_dir(job_id):
    """Get or create job-specific directory"""
    job_dir = MATERIALIZER_WORK_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir

@app.route('/api/materializer/generate', methods=['POST'])
def generate_textures():
    """Generate texture maps using Materializer"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        mode = request.form.get('mode', 'pbr')
        preset = request.form.get('preset', 'metal')
        
        if mode not in GENERATION_MODES:
            return jsonify({'error': f'Invalid mode: {mode}'}), 400
        
        # Create job directory
        job_id = str(uuid.uuid4())[:8]
        job_dir = _get_job_dir(job_id)
        
        # Save input file
        input_path = job_dir / f"input_{file.filename}"
        file.save(str(input_path))
        logger.info(f"Saved input file: {input_path}")
        
        # In production, this would call Materializer with automation
        # For now, create a job record and return job ID
        job_record = {
            'job_id': job_id,
            'mode': mode,
            'preset': preset,
            'input_file': str(input_path),
            'status': 'submitted',
        }
        
        job_file = job_dir / 'job.json'
        with open(job_file, 'w') as f:
            json.dump(job_record, f)
        
        return jsonify({
            'success': True,
            'id': job_id,
            'status': 'submitted',
            'message': 'Materializer job submitted',
            'job_id': job_id,
            'preset': preset,
            'mode': mode,
        }), 202
    except FileNotFoundError as e:
        return jsonify({'error': f'File error: {str(e)}'}), 404
    except Exception as e:
        logger.error(f"Generation error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Generation failed: {str(e)}'}), 500

@app.route('/api/materializer/presets', methods=['GET'])
def get_presets():
    """Get available material presets"""
    presets = []
    for name, description in MATERIAL_PRESETS.items():
        presets.append({
            'name': name,
            'type': 'material',
            'description': description,
        })
    return jsonify({'presets': presets})

@app.route('/api/materializer/status/<job_id>', methods=['GET'])
def get_status(job_id):
    """Check job status"""
    try:
        job_dir = _get_job_dir(job_id)
        job_file = job_dir / 'job.json'
        
        if not job_file.exists():
            return jsonify({'error': 'Job not found'}), 404
        
        with open(job_file, 'r') as f:
            job = json.load(f)
        
        return jsonify(job), 200
    except Exception as e:
        logger.error(f"Status check error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/materializer/jobs', methods=['GET'])
def list_jobs():
    """List all submitted jobs"""
    try:
        jobs = []
        for job_dir in MATERIALIZER_WORK_DIR.iterdir():
            if job_dir.is_dir():
                job_file = job_dir / 'job.json'
                if job_file.exists():
                    with open(job_file, 'r') as f:
                        jobs.append(json.load(f))
        return jsonify({'jobs': jobs}), 200
    except Exception as e:
        logger.error(f"List jobs error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/materializer/health', methods=['GET'])
def health():
    """Health check - verify Materializer is available"""
    try:
        _verify_materializer()
        return jsonify({
            'status': 'ok',
            'materializer': 'available',
            'exe': MATERIALIZER_EXE,
            'work_dir': str(MATERIALIZER_WORK_DIR),
        }), 200
    except FileNotFoundError as e:
        return jsonify({
            'status': 'error',
            'materializer': 'not_found',
            'message': str(e),
            'expected_path': MATERIALIZER_EXE,
        }), 503

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    try:
        _verify_materializer()
        logger.info(f"Starting Materializer service on port {MATERIALIZER_PORT}")
        app.run(host='0.0.0.0', port=MATERIALIZER_PORT, debug=False)
    except FileNotFoundError as e:
        logger.error(f"Cannot start service: {e}")
        print(f"ERROR: {e}")
        exit(1)
