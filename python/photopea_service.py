"""
Photopea Service - Handles file operations for Photopea editor integration
Manages saving, retrieving, and organizing files edited in Photopea
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Tuple
import logging
import base64
import struct
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import io

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
PHOTOPEA_PORT = int(os.getenv('PHOTOPEA_SERVICE_PORT', 8008))
PHOTOPEA_FILES_DIR = Path(os.getenv('PHOTOPEA_FILES_DIR', './photopea_files'))
PHOTOPEA_FILES_DIR.mkdir(parents=True, exist_ok=True)

# Supported formats
SUPPORTED_FORMATS = ['psd', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff']


class PhotopeaFileManager:
    """Manages file operations for Photopea"""

    def __init__(self, base_dir: Path = PHOTOPEA_FILES_DIR):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def get_files_list(self) -> List[Dict]:
        """Get list of all saved files with metadata"""
        files = []
        if self.base_dir.exists():
            for file in self.base_dir.iterdir():
                if file.is_file():
                    stat = file.stat()
                    files.append({
                        'filename': file.name,
                        'size': stat.st_size,
                        'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        'ext': file.suffix[1:] if file.suffix else 'unknown',
                    })
        return sorted(files, key=lambda x: x['modified'], reverse=True)

    def parse_photopea_binary(self, binary_data: bytes) -> Tuple[Dict, bytes]:
        """
        Parse Photopea binary data format:
        - First 2000 bytes: JSON metadata
        - Rest: Binary file data
        """
        try:
            # Extract JSON metadata (first 2000 bytes)
            json_data_str = binary_data[:2000].decode('utf-8').rstrip('\x00')
            metadata = json.loads(json_data_str)
            
            # Extract binary file data (rest of the bytes)
            file_data = binary_data[2000:]
            
            logger.info(f"Parsed Photopea data: {metadata}")
            return metadata, file_data
        except Exception as e:
            logger.error(f"Error parsing Photopea binary: {e}")
            raise

    def save_file(self, metadata: Dict, file_data: bytes) -> str:
        """Save a file from Photopea with metadata"""
        try:
            source = metadata.get('source', '')
            versions = metadata.get('versions', [])
            
            # Generate filename based on source or timestamp
            if source and not source.startswith('local'):
                filename = Path(source).name
            else:
                filename = f"photopea_{datetime.now().strftime('%Y%m%d_%H%M%S')}.psd"
            
            # Ensure unique filename
            filepath = self.base_dir / filename
            counter = 1
            while filepath.exists():
                name_part, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
                new_name = f"{name_part}_{counter}.{ext}" if ext else f"{filename}_{counter}"
                filepath = self.base_dir / new_name
                counter += 1
            
            # Write file data
            with open(filepath, 'wb') as f:
                f.write(file_data)
            
            logger.info(f"Saved file: {filepath} ({len(file_data)} bytes)")
            return filepath.name
        except Exception as e:
            logger.error(f"Error saving file: {e}")
            raise

    def get_file(self, filename: str) -> Optional[bytes]:
        """Retrieve a file by filename"""
        try:
            filepath = (self.base_dir / filename).resolve()
            
            # Security check - ensure file is in base directory
            if not str(filepath).startswith(str(self.base_dir.resolve())):
                logger.error(f"Security error: attempted access outside base directory")
                return None
            
            if filepath.exists():
                with open(filepath, 'rb') as f:
                    return f.read()
            return None
        except Exception as e:
            logger.error(f"Error retrieving file: {e}")
            return None

    def delete_file(self, filename: str) -> bool:
        """Delete a file"""
        try:
            filepath = (self.base_dir / filename).resolve()
            
            # Security check
            if not str(filepath).startswith(str(self.base_dir.resolve())):
                logger.error(f"Security error: attempted deletion outside base directory")
                return False
            
            if filepath.exists():
                filepath.unlink()
                logger.info(f"Deleted file: {filepath}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting file: {e}")
            return False


# Initialize file manager
file_manager = PhotopeaFileManager()


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'photopea',
        'files_dir': str(PHOTOPEA_FILES_DIR),
    })


@app.route('/api/photopea/save', methods=['POST'])
def save_file():
    """
    Save file from Photopea
    Receives binary data with JSON metadata
    """
    try:
        # Check if raw binary data
        if request.content_type and 'application/octet-stream' in request.content_type:
            # Raw binary data from Photopea
            binary_data = request.get_data()
            metadata, file_data = file_manager.parse_photopea_binary(binary_data)
        else:
            # FormData with metadata and file
            metadata_str = request.form.get('metadata', '{}')
            metadata = json.loads(metadata_str)
            file_data = request.files['file'].read() if 'file' in request.files else b''
        
        filename = file_manager.save_file(metadata, file_data)
        
        return jsonify({
            'success': True,
            'filename': filename,
            'size': len(file_data),
            'message': f'File saved successfully: {filename}',
            'newSource': f'/api/photopea/download/{filename}',
        })
    except Exception as e:
        logger.error(f"Error in save endpoint: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
        }), 400


@app.route('/api/photopea/saved-files', methods=['GET'])
def get_saved_files():
    """Get list of saved files"""
    try:
        files = file_manager.get_files_list()
        return jsonify({
            'success': True,
            'files': files,
            'count': len(files),
        })
    except Exception as e:
        logger.error(f"Error getting files: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
        }), 400


@app.route('/api/photopea/download/<filename>', methods=['GET'])
def download_file(filename: str):
    """Download a saved file"""
    try:
        file_data = file_manager.get_file(filename)
        if file_data is None:
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(
            io.BytesIO(file_data),
            mimetype='application/octet-stream',
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        return jsonify({'error': str(e)}), 400


@app.route('/api/photopea/delete/<filename>', methods=['DELETE'])
def delete_file(filename: str):
    """Delete a saved file"""
    try:
        success = file_manager.delete_file(filename)
        if success:
            return jsonify({'success': True, 'message': f'File deleted: {filename}'})
        else:
            return jsonify({'success': False, 'error': 'File not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/photopea/info/<filename>', methods=['GET'])
def get_file_info(filename: str):
    """Get information about a specific file"""
    try:
        files = file_manager.get_files_list()
        file_info = next((f for f in files if f['filename'] == filename), None)
        
        if file_info:
            return jsonify({'success': True, 'file': file_info})
        else:
            return jsonify({'success': False, 'error': 'File not found'}), 404
    except Exception as e:
        logger.error(f"Error getting file info: {e}")
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/photopea/stats', methods=['GET'])
def get_stats():
    """Get statistics about saved files"""
    try:
        files = file_manager.get_files_list()
        total_size = sum(f['size'] for f in files)
        
        format_stats = {}
        for f in files:
            ext = f['ext']
            if ext not in format_stats:
                format_stats[ext] = 0
            format_stats[ext] += 1
        
        return jsonify({
            'success': True,
            'total_files': len(files),
            'total_size': total_size,
            'by_format': format_stats,
        })
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 400


def run_service():
    """Run the Photopea service"""
    logger.info(f"Starting Photopea Service on port {PHOTOPEA_PORT}")
    logger.info(f"Files directory: {PHOTOPEA_FILES_DIR}")
    
    app.run(
        host='127.0.0.1',
        port=PHOTOPEA_PORT,
        debug=False,
        use_reloader=False,
    )


if __name__ == '__main__':
    run_service()
