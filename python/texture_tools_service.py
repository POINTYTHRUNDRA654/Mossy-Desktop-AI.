"""
NVIDIA Texture Tools Service Wrapper
Flask backend wrapping nvcompress and related NVIDIA Texture Tools executables
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
TEXTURE_TOOLS_PORT = int(os.getenv('TEXTURE_TOOLS_SERVICE_PORT', 8012))
TEXTURE_TOOLS_WORK_DIR = Path(os.getenv('TEXTURE_TOOLS_WORK_DIR', './texture_tools_work'))
NVIDIA_TOOLS_DIR = os.getenv('NVIDIA_TOOLS_DIR', 'D:\\NVIDIA Texture Tools')

# Tool paths
NVCOMPRESS_EXE = os.path.join(NVIDIA_TOOLS_DIR, 'nvcompress.exe')
NVDECOMPRESS_EXE = os.path.join(NVIDIA_TOOLS_DIR, 'nvdecompress.exe')
NVDDSINFO_EXE = os.path.join(NVIDIA_TOOLS_DIR, 'nvddsinfo.exe')
NVTT_EXPORT_EXE = os.path.join(NVIDIA_TOOLS_DIR, 'nvtt_export.exe')

# Ensure work directory exists
TEXTURE_TOOLS_WORK_DIR.mkdir(parents=True, exist_ok=True)

# Supported compression formats
COMPRESSION_FORMATS = {
    'bc1': 'BC1/DXT1 - Fast, good for opaque textures',
    'bc3': 'BC3/DXT5 - With alpha channel',
    'bc4': 'BC4 - Single channel compression',
    'bc5': 'BC5 - Two channel (normal maps)',
    'bc6h': 'BC6H - HDR compression',
    'bc7': 'BC7 - High quality RGBA',
    'astc': 'ASTC - Adaptive scalable compression',
}

# Quality levels
QUALITY_LEVELS = {
    'fast': 'Fastest compression',
    'normal': 'Normal quality/speed balance',
    'production': 'Production quality',
    'highest': 'Highest quality (slow)',
}

def _verify_tools():
    """Check if NVIDIA Texture Tools are available"""
    if not os.path.exists(NVCOMPRESS_EXE):
        logger.error(f"nvcompress not found at {NVCOMPRESS_EXE}")
        raise FileNotFoundError(f"NVIDIA Texture Tools not found at {NVIDIA_TOOLS_DIR}")
    logger.info(f"NVIDIA Texture Tools found at {NVIDIA_TOOLS_DIR}")
    return True

def _get_job_dir(job_id):
    """Get or create job-specific directory"""
    job_dir = TEXTURE_TOOLS_WORK_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_dir

def _run_nvcompress(input_file, output_file, format_type='bc3', quality='normal'):
    """Run nvcompress with specified parameters"""
    try:
        cmd = [
            NVCOMPRESS_EXE,
            '-format', format_type,
            '-quality', quality,
            str(input_file),
            str(output_file)
        ]
        
        logger.info(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            logger.error(f"nvcompress failed: {result.stderr}")
            raise RuntimeError(f"Compression failed: {result.stderr}")
        
        return True
    except subprocess.TimeoutExpired:
        logger.error("nvcompress timeout")
        raise RuntimeError("Compression timeout (5 minutes)")
    except Exception as e:
        logger.error(f"nvcompress error: {str(e)}")
        raise

@app.route('/api/texture-tools/compress', methods=['POST'])
def compress_texture():
    """Compress texture using nvcompress"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        format_type = request.form.get('format', 'bc3')
        quality = request.form.get('quality', 'normal')
        
        if format_type not in COMPRESSION_FORMATS:
            return jsonify({'error': f'Invalid format: {format_type}'}), 400
        
        if quality not in QUALITY_LEVELS:
            return jsonify({'error': f'Invalid quality: {quality}'}), 400
        
        # Create job directory
        job_id = str(uuid.uuid4())[:8]
        job_dir = _get_job_dir(job_id)
        
        # Save input file
        input_path = job_dir / f"input_{file.filename}"
        file.save(str(input_path))
        logger.info(f"Saved input: {input_path}")
        
        # Prepare output path
        output_path = job_dir / f"compressed_{job_id}.dds"
        
        # Run compression
        _run_nvcompress(input_path, output_path, format_type, quality)
        
        # Job record
        job_record = {
            'job_id': job_id,
            'operation': 'compress',
            'format': format_type,
            'quality': quality,
            'input_file': str(input_path),
            'output_file': str(output_path),
            'status': 'completed',
            'size': os.path.getsize(output_path),
        }
        
        job_file = job_dir / 'job.json'
        with open(job_file, 'w') as f:
            json.dump(job_record, f)
        
        return jsonify({
            'success': True,
            'id': job_id,
            'status': 'completed',
            'format': format_type,
            'quality': quality,
            'output_file': str(output_path),
            'size': os.path.getsize(output_path),
        }), 200
    except FileNotFoundError as e:
        return jsonify({'error': f'File error: {str(e)}'}), 404
    except Exception as e:
        logger.error(f"Compression error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Compression failed: {str(e)}'}), 500

@app.route('/api/texture-tools/formats', methods=['GET'])
def get_formats():
    """Get available compression formats"""
    formats = []
    for name, description in COMPRESSION_FORMATS.items():
        formats.append({
            'name': name,
            'type': 'compression',
            'description': description,
        })
    return jsonify({'formats': formats})

@app.route('/api/texture-tools/quality-levels', methods=['GET'])
def get_quality_levels():
    """Get available quality levels"""
    levels = []
    for name, description in QUALITY_LEVELS.items():
        levels.append({
            'name': name,
            'description': description,
        })
    return jsonify({'levels': levels})

@app.route('/api/texture-tools/status/<job_id>', methods=['GET'])
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

@app.route('/api/texture-tools/download/<job_id>', methods=['GET'])
def download_result(job_id):
    """Download compressed texture"""
    try:
        job_dir = _get_job_dir(job_id)
        job_file = job_dir / 'job.json'
        
        if not job_file.exists():
            return jsonify({'error': 'Job not found'}), 404
        
        with open(job_file, 'r') as f:
            job = json.load(f)
        
        output_file = Path(job['output_file'])
        if not output_file.exists():
            return jsonify({'error': 'Output file not found'}), 404
        
        return send_file(str(output_file), mimetype='application/octet-stream',
                        as_attachment=True, download_name=output_file.name)
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/texture-tools/jobs', methods=['GET'])
def list_jobs():
    """List all jobs"""
    try:
        jobs = []
        for job_dir in TEXTURE_TOOLS_WORK_DIR.iterdir():
            if job_dir.is_dir():
                job_file = job_dir / 'job.json'
                if job_file.exists():
                    with open(job_file, 'r') as f:
                        jobs.append(json.load(f))
        return jsonify({'jobs': jobs}), 200
    except Exception as e:
        logger.error(f"List jobs error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/texture-tools/health', methods=['GET'])
def health():
    """Health check"""
    try:
        _verify_tools()
        return jsonify({
            'status': 'ok',
            'tools': 'available',
            'tools_dir': NVIDIA_TOOLS_DIR,
            'nvcompress': NVCOMPRESS_EXE,
            'work_dir': str(TEXTURE_TOOLS_WORK_DIR),
        }), 200
    except FileNotFoundError as e:
        return jsonify({
            'status': 'error',
            'tools': 'not_found',
            'message': str(e),
            'expected_path': NVIDIA_TOOLS_DIR,
        }), 503

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    try:
        _verify_tools()
        logger.info(f"Starting NVIDIA Texture Tools service on port {TEXTURE_TOOLS_PORT}")
        app.run(host='0.0.0.0', port=TEXTURE_TOOLS_PORT, debug=False)
    except FileNotFoundError as e:
        logger.error(f"Cannot start service: {e}")
        print(f"ERROR: {e}")
        exit(1)
