# Photopea Editor Integration

## Overview

The Photopea Editor integration brings a professional image and design editing capability to Mossy Desktop AI. Photopea is a web-based alternative to Photoshop with full PSD support and extensive editing capabilities.

## Features

- **Professional Image Editing**: Full support for image manipulation and design work
- **File Format Support**: PSD, PNG, JPG, WebP, GIF, BMP, TIFF
- **Server-side File Management**: Automatic file saving and organization
- **Session Persistence**: Save and retrieve edited files
- **Web-based**: Runs directly in the browser via iframe
- **Cross-platform**: Works on Windows, macOS, and Linux

## Architecture

### Components

1. **PhotopeaEditor.tsx** - React component that embeds Photopea in an iframe
   - Handles file uploads
   - Manages save/load operations
   - Displays file library
   - Communicates with Photopea via postMessage API

2. **photopea_service.py** - Flask backend service
   - Runs on port 8008 (configurable)
   - Handles file persistence
   - Manages file metadata
   - Provides REST API for file operations
   - CORS-enabled for web access

3. **photopea.ts** - TypeScript utilities
   - Configuration helpers
   - API communication functions
   - Script execution utilities
   - File management helpers

## Usage

### Opening the Photopea Editor

Navigate to: `http://localhost:3000/#/photopea` (or use the sidebar)

### File Operations

#### Upload a File
1. Click "Open File" button
2. Select an image or PSD file from your system
3. The file opens in Photopea

#### Save a File
1. Edit your image/design in Photopea
2. Click "Save" button
3. File is automatically sent to the backend service
4. File is stored in the `photopea_files` directory

#### View Saved Files
1. Click "Files (X)" button to expand the saved files panel
2. Browse through your saved files
3. Click the download icon to download any file

### Configuration

#### Environment Variables

```bash
# Set the port for Photopea service
export PHOTOPEA_SERVICE_PORT=8008

# Set the directory for storing files
export PHOTOPEA_FILES_DIR=/path/to/photopea_files
```

#### Default Locations

- **Service Port**: 8008
- **Files Directory**: `./photopea_files` (relative to current working directory)

## API Endpoints

### `/api/photopea/save` (POST)

Save a file from Photopea

**Request**: Binary data with JSON metadata (first 2000 bytes)

**Response**:
```json
{
  "success": true,
  "filename": "design_20240507_120000.psd",
  "size": 1024000,
  "message": "File saved successfully",
  "newSource": "/api/photopea/download/design_20240507_120000.psd"
}
```

### `/api/photopea/saved-files` (GET)

Get list of all saved files

**Response**:
```json
{
  "success": true,
  "files": [
    {
      "filename": "design.psd",
      "size": 1024000,
      "created": "2024-05-07T12:00:00",
      "modified": "2024-05-07T13:30:00",
      "ext": "psd"
    }
  ],
  "count": 1
}
```

### `/api/photopea/download/<filename>` (GET)

Download a saved file

**Response**: File binary data

### `/api/photopea/delete/<filename>` (DELETE)

Delete a saved file

**Response**:
```json
{
  "success": true,
  "message": "File deleted: design.psd"
}
```

### `/api/photopea/info/<filename>` (GET)

Get information about a specific file

**Response**:
```json
{
  "success": true,
  "file": {
    "filename": "design.psd",
    "size": 1024000,
    "created": "2024-05-07T12:00:00",
    "modified": "2024-05-07T13:30:00",
    "ext": "psd"
  }
}
```

### `/api/photopea/stats` (GET)

Get statistics about saved files

**Response**:
```json
{
  "success": true,
  "total_files": 5,
  "total_size": 5120000,
  "by_format": {
    "psd": 2,
    "png": 2,
    "jpg": 1
  }
}
```

### `/health` (GET)

Health check endpoint

**Response**:
```json
{
  "status": "healthy",
  "service": "photopea",
  "files_dir": "/path/to/photopea_files"
}
```

## File Format

### Photopea Binary Format

When Photopea sends a file to the server:
- **First 2000 bytes**: JSON metadata
- **Remaining bytes**: Binary file data

**Metadata structure**:
```json
{
  "source": "https://example.com/file.psd",
  "versions": [
    {
      "format": "psd",
      "start": 0,
      "size": 1000000
    },
    {
      "format": "png",
      "start": 1000000,
      "size": 500000
    }
  ]
}
```

## Supported File Formats

- **PSD** - Photoshop Document (full support)
- **PNG** - Portable Network Graphics
- **JPG/JPEG** - Joint Photographic Experts Group
- **WebP** - Web Picture Format
- **GIF** - Graphics Interchange Format
- **BMP** - Bitmap
- **TIFF** - Tagged Image File Format

## Security Considerations

1. **File Path Validation**: All file paths are validated to prevent directory traversal
2. **CORS**: CORS is enabled for local development (can be restricted in production)
3. **File Size**: No explicit limit is enforced, but backend filesystem limits apply
4. **Sandboxing**: Photopea runs in an iframe with origin restrictions

## Troubleshooting

### Photopea Doesn't Load
- Check browser console for CORS errors
- Verify Photopea URL is accessible (https://www.photopea.com)
- Check that postMessage communication is working

### Files Not Saving
- Check that the Photopea service is running (port 8008)
- Verify the `photopea_files` directory exists and is writable
- Check browser console and server logs for errors
- Ensure adequate disk space

### Import/Export Issues
- Verify the file format is supported
- Check file size limits on your system
- Try exporting to a different format

## Development

### Starting the Service Manually

```bash
cd python
PHOTOPEA_SERVICE_PORT=8008 python photopea_service.py
```

### Testing File Save

```bash
curl -X POST http://localhost:8008/api/photopea/saved-files
```

### View Service Logs

The service logs to stdout and can be monitored in the electron console.

## Performance Tips

1. **Organize Files**: Regularly clean up old files to keep the directory manageable
2. **Format Selection**: Use PNG/WebP for web images, PSD for editing
3. **Batch Operations**: Group multiple edits before saving
4. **Memory**: Large PSD files may consume significant browser memory

## Future Enhancements

- [ ] Image preview thumbnails
- [ ] File versioning/history
- [ ] Collaborative editing
- [ ] Integration with other Mossy tools
- [ ] Batch processing
- [ ] Custom preset management
- [ ] Layer extraction/management UI
- [ ] Advanced batch operations via Python service

## References

- [Photopea API Documentation](https://www.photopea.com/api.html)
- [Photopea Features](https://www.photopea.com)
- Flask Documentation: https://flask.palletsprojects.com/
- postMessage API: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage

## License

Photopea integration for Mossy Desktop AI follows the same license as the main project.
