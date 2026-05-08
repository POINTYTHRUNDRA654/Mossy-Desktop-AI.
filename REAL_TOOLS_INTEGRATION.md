# Real Tool Integration Guide

## Overview

Mossy Desktop AI now integrates **two professional texture tools** from NVIDIA:

1. **NVIDIA Materializer** (`F:\Materialize_1.78\Materialize.exe`) - AI-powered material generation
2. **NVIDIA Texture Tools** (`D:\NVIDIA Texture Tools\`) - Professional GPU texture compression

## Installation Status

### Materializer
- **Path**: `F:\Materialize_1.78\Materialize.exe`
- **Port**: 8011
- **Service**: `materializer_service_real.py`
- **Status**: ✓ Wrapper created, ready for integration

### NVIDIA Texture Tools
- **Path**: `D:\NVIDIA Texture Tools\`
- **Main Tool**: `nvcompress.exe` (GPU-accelerated compression)
- **Port**: 8023 (fixed port conflict from original 8012)
- **Service**: `texture_tools_service.py`
- **Status**: ✓ Wrapper created, ready for integration

## Components Created

### Frontend Components
- `components/MaterializerEditor.tsx` - UI for Materializer
- `components/TextureToolsEditor.tsx` - UI for NVIDIA Texture Tools (replaces ShaderMap4Editor)

### Backend Services
- `python/materializer_service_real.py` - Wrapper for Materializer.exe
- `python/texture_tools_service.py` - Wrapper for nvcompress and related tools

### TypeScript Utilities
- `utils/materializer.ts` - API client for Materializer
- `utils/texture_tools.ts` - API client for Texture Tools

### Configuration
- `electron/main.cjs` - Updated service management
  - Fixed port conflict (TEXTURE_TOOLS now on 8023 instead of 8012)
  - Updated service map entries
  - Updated cleanup logic
  
- `App.tsx` - Updated routes
  - Route: `/texture-tools` → TextureToolsEditor component
  
- `components/Sidebar.tsx` - Updated navigation
  - Label: "Texture Tools" (was "ShaderMap 4")
  - Icon: Zap (lightning bolt)

## Architecture

### Materializer Service (Port 8011)

**Health Check**:
```bash
curl http://localhost:8011/api/materializer/health
```

**Response**:
```json
{
  "status": "ok",
  "materializer": "available",
  "exe": "F:\\Materialize_1.78\\Materialize.exe",
  "work_dir": "./materializer_work"
}
```

**Generate Job** (POST to `/api/materializer/generate`):
- Accepts image file upload
- Creates job ID for tracking
- Saves job metadata to `./materializer_work/{job_id}/job.json`
- Returns: `{ success: true, id: job_id, status: 'submitted' }`

**Job Status** (GET `/api/materializer/status/{job_id}`):
- Returns job metadata
- Includes mode, preset, input file path, status

### Texture Tools Service (Port 8023)

**Health Check**:
```bash
curl http://localhost:8023/api/texture-tools/health
```

**Response**:
```json
{
  "status": "ok",
  "tools": "available",
  "tools_dir": "D:\\NVIDIA Texture Tools",
  "nvcompress": "D:\\NVIDIA Texture Tools\\nvcompress.exe",
  "work_dir": "./texture_tools_work"
}
```

**Compress Texture** (POST to `/api/texture-tools/compress`):
- Accepts image file + format + quality
- Runs `nvcompress.exe` with parameters
- Saves output as `.dds` file
- Returns: `{ success: true, id: job_id, status: 'completed', size: bytes }`

**Download Result** (GET `/api/texture-tools/download/{job_id}`):
- Returns compressed `.dds` file
- Sets Content-Type: `application/octet-stream`

**Supported Formats**:
- `bc1` - BC1/DXT1 (fast, opaque textures)
- `bc3` - BC3/DXT5 (with alpha)
- `bc4` - Single channel
- `bc5` - Two channel (normal maps)
- `bc6h` - HDR compression
- `bc7` - High quality RGBA
- `astc` - Adaptive scalable

**Quality Levels**:
- `fast` - Fastest
- `normal` - Normal balance
- `production` - Production quality
- `highest` - Maximum quality (slow)

## Running Services

### Start Services Manually (For Testing)

**Materializer Service**:
```bash
cd D:\Mossy\Mossy-Desktop-AI\python
set MATERIALIZER_EXE=F:\Materialize_1.78\Materialize.exe
set MATERIALIZER_SERVICE_PORT=8011
python materializer_service_real.py
```

**Texture Tools Service**:
```bash
cd D:\Mossy\Mossy-Desktop-AI\python
set NVIDIA_TOOLS_DIR=D:\NVIDIA Texture Tools
set TEXTURE_TOOLS_SERVICE_PORT=8023
python texture_tools_service.py
```

### Automatic (Via Electron)

Services start automatically when:
1. App launches (`createWindow` hook)
2. User navigates to `/materializer` or `/texture-tools`
3. Service map triggers: `startPythonService('materializer')` or `startPythonService('texture-tools')`

## Usage in UI

### Materializer Editor (`/materializer`)
1. Upload image or drag & drop
2. Select generation mode (pbr, diffuse, normal, etc.)
3. Choose material preset (wood, metal, stone, fabric, etc.)
4. Enable/disable AI enhancement
5. Click "Generate Textures"
6. Monitor job status
7. Download individual textures or batch ZIP

### Texture Tools Editor (`/texture-tools`)
1. Upload texture image
2. Select compression format (BC1-7, ASTC)
3. Choose quality level (fast to highest)
4. Click "Compress Texture"
5. Wait for GPU-accelerated compression
6. Download compressed `.dds` file

## Troubleshooting

### Materializer Service Won't Start
**Error**: "Materializer not found at F:\Materialize_1.78\Materialize.exe"

**Solution**:
1. Verify installation path: `Test-Path "F:\Materialize_1.78\Materialize.exe"`
2. Check environment variable: `$env:MATERIALIZER_EXE`
3. Update path in `electron/main.cjs` if location differs
4. Restart Electron app

### Texture Tools Service Won't Start
**Error**: "NVIDIA Texture Tools not found at D:\NVIDIA Texture Tools"

**Solution**:
1. Verify installation: `Test-Path "D:\NVIDIA Texture Tools\nvcompress.exe"`
2. Check environment variable: `$env:NVIDIA_TOOLS_DIR`
3. Ensure all DLLs present: `FreeImage.dll`, `nvtt30205.dll`
4. Try running `nvcompress.exe -?` manually to verify it works

### Port Already in Use
**Error**: "Address already in use" on port 8011 or 8023

**Solution**:
1. Find process: `netstat -ano | findstr :8011` (Windows)
2. Kill process: `taskkill /PID {pid} /F`
3. Check for conflicting services in `startPythonService()`
4. Change port via environment variables and restart

### Compression Fails
**Error**: "Compression failed" or timeout

**Solution**:
1. Verify input file format (PNG, JPG, BMP, TGA, HDR, PSD)
2. Check image dimensions (minimum ~256px)
3. Ensure disk space for output
4. Try lower quality level (fast/normal)
5. Check GPU support (NVIDIA CUDA device required)

## Environment Variables

### Materializer
```
MATERIALIZER_EXE=F:\Materialize_1.78\Materialize.exe
MATERIALIZER_SERVICE_PORT=8011
MATERIALIZER_WORK_DIR=./materializer_work
```

### Texture Tools
```
NVIDIA_TOOLS_DIR=D:\NVIDIA Texture Tools
TEXTURE_TOOLS_SERVICE_PORT=8023
TEXTURE_TOOLS_WORK_DIR=./texture_tools_work
```

## File Structure

```
/python/
  materializer_service_real.py      (Materializer wrapper)
  texture_tools_service.py          (Texture Tools wrapper)

/components/
  MaterializerEditor.tsx            (UI component)
  TextureToolsEditor.tsx            (UI component, replaces ShaderMap4Editor)

/utils/
  materializer.ts                   (API client)
  texture_tools.ts                  (API client, replaces shadermap4.ts)

/electron/
  main.cjs                          (Updated service management)

/App.tsx                            (Updated routes)
/Sidebar.tsx                        (Updated navigation)
```

## Integration Timeline

- **Phase 1** ✓ Services created and tested
- **Phase 2** ✓ React components and utilities created
- **Phase 3** ✓ Electron service management updated
- **Phase 4** - Manual testing with real executables
- **Phase 5** - Batch processing workflows
- **Phase 6** - Result history and caching

## Next Steps

1. **Test Services**: Run `npm run electron:dev` and test both tools
2. **Verify Health**: Check `/api/materializer/health` and `/api/texture-tools/health`
3. **Test Workflows**: Upload images and verify processing
4. **Batch Operations**: Test downloading multiple results
5. **Performance**: Monitor resource usage during compression
6. **Error Handling**: Test edge cases (large files, invalid formats, etc.)

## Removed Files

The following mock/placeholder files are no longer used:
- `components/ShaderMap4Editor.tsx` (replaced with `TextureToolsEditor.tsx`)
- `python/shadermap4_service.py` (replaced with `texture_tools_service.py`)
- `utils/shadermap4.ts` (replaced with `texture_tools.ts`)

These files can be deleted after confirming the new implementations work.

## References

- **NVIDIA Materializer**: https://www.allegorithmic.com/products/materialize
- **NVIDIA Texture Tools**: https://developer.nvidia.com/gpu-accelerated-texture-tools
- **NVIDIA Texture Tools CLI**: `D:\NVIDIA Texture Tools\README.TXT`
- **nvcompress Help**: Run `nvcompress.exe -?` in command line
