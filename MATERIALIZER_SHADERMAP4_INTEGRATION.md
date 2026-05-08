# NVIDIA Materializer & ShaderMap 4 Integration

## Overview

This integration brings professional texture generation (NVIDIA Materializer) and shader authoring (ShaderMap 4) capabilities to Mossy Desktop AI. These tools enable game developers and content creators to generate high-quality materials and shaders directly from source images.

## Features

### NVIDIA Materializer
- **AI-Powered Texture Generation**: Generate PBR texture suites from single images
- **Multiple Generation Modes**: 
  - Full PBR suite (Diffuse, Normal, Roughness, Metallic, AO)
  - Individual map generation (Diffuse, Normal, Roughness, etc.)
- **Material Presets**: Pre-configured presets for common materials
- **AI Enhancement**: Advanced processing for higher quality output
- **Batch Operations**: Download all textures as ZIP

### ShaderMap 4
- **Professional Shader Authoring**: Create complex shader node graphs
- **Multiple Shader Types**: PBR, Standard, Substance Designer, Custom
- **Quality Levels**: Draft to Ultra (with processing time hints)
- **Shader Templates**: Pre-built shader templates for common use cases
- **Preview Generation**: Visual previews of generated shaders
- **Format Support**: Export to multiple shader formats

## Architecture

### Components

#### 1. MaterializerEditor.tsx
- React component for texture generation
- File upload with preview
- Generation mode selection
- Material preset browser
- Results grid with download options
- Real-time status indicators

#### 2. ShaderMap4Editor.tsx
- React component for shader authoring
- Similar workflow to Materializer
- Shader type and quality selection
- Template browser
- Detailed shader inspection view
- Batch download capabilities

#### 3. Python Services
- **materializer_service.py** (Port 8011)
  - Texture generation engine
  - Supports multiple generation modes
  - Prebuilt material presets
  - ZIP export functionality

- **shadermap4_service.py** (Port 8012)
  - Shader graph generation
  - Node-based shader system
  - Template management
  - Preview generation

#### 4. TypeScript Utilities
- **materializer.ts**: API communication for texture tools
- **shadermap4.ts**: API communication for shader tools

## Usage

### Accessing the Tools

**Materializer**: Navigate to `/#/materializer` or click "Materializer" in sidebar  
**ShaderMap 4**: Navigate to `/#/shadermap4` or click "ShaderMap 4" in sidebar

### Materializer Workflow

1. **Upload Image**: Drag/drop or click to upload a source image
2. **Select Generation Mode**:
   - `pbr` - Full PBR texture suite
   - `diffuse` - Albedo/diffuse map only
   - `normal` - Normal map generation
   - `roughness` - Roughness map
   - `metallic` - Metallic/specular map
   - `ao` - Ambient occlusion map

3. **Choose Options**:
   - Enable AI Enhancement for better quality
   - Select material preset (Wood, Metal, Stone, Fabric, etc.)

4. **Generate**: Click "Generate Textures"
5. **Download**: 
   - Download individual textures
   - Download all as ZIP archive

### ShaderMap 4 Workflow

1. **Upload Image**: Provide a reference image
2. **Select Shader Type**:
   - `pbr` - PBR shader with full maps
   - `standard` - Simple diffuse shader
   - `substance` - Substance Designer format
   - `custom` - Fully customizable

3. **Choose Quality**:
   - `draft` - Fast (30s), lower quality
   - `standard` - Normal (1-2min)
   - `high` - Better quality (2-5min)
   - `ultra` - Best quality (5-10min)

4. **Select Template** (optional): Choose from predefined shader templates
5. **Generate**: Click "Generate Shaders"
6. **Review**: View shader properties and preview
7. **Download**: Download as ZIP with node graph and preview

## API Endpoints

### Materializer Endpoints

#### `/api/materializer/generate` (POST)
Generate textures from image

**Request**:
```json
{
  "file": "image file",
  "mode": "pbr|diffuse|normal|roughness|metallic|ao",
  "ai_enhance": true,
  "preset": "wood|metal|stone|fabric|plastic|ceramic|leather|rubber"
}
```

**Response**:
```json
{
  "success": true,
  "id": "abc12345",
  "textures": [
    {
      "id": "abc12345_diffuse",
      "name": "diffuse",
      "format": "png",
      "size": 4194304,
      "generated_at": "2024-05-07T12:00:00",
      "mode": "pbr"
    }
  ]
}
```

#### `/api/materializer/presets` (GET)
Get available material presets

**Response**:
```json
{
  "presets": [
    {
      "name": "wood",
      "type": "organic",
      "description": "Natural wood texture generation"
    }
  ]
}
```

#### `/api/materializer/download/<texture_id>` (GET)
Download individual texture

#### `/api/materializer/download-all` (GET)
Download all textures as ZIP

#### `/api/materializer/health` (GET)
Service health check

### ShaderMap 4 Endpoints

#### `/api/shadermap4/generate` (POST)
Generate shaders from image

**Request**:
```json
{
  "file": "image file",
  "type": "pbr|standard|custom|substance",
  "quality": "draft|standard|high|ultra",
  "template": "pbr_metallic|pbr_roughness|standard_diffuse|substance_advanced|custom_nodes"
}
```

**Response**:
```json
{
  "success": true,
  "id": "xyz98765",
  "shaders": [
    {
      "id": "xyz98765",
      "name": "PBR_Shader_xyz98765",
      "type": "pbr",
      "quality": "high",
      "size": 52428,
      "generated_at": "2024-05-07T12:00:00",
      "preview": "/api/shadermap4/preview/xyz98765_pbr_preview.png"
    }
  ]
}
```

#### `/api/shadermap4/templates` (GET)
Get available shader templates

#### `/api/shadermap4/download/<shader_id>` (GET)
Download shader package (includes node graph + preview)

#### `/api/shadermap4/download-all` (GET)
Download all shaders as ZIP

#### `/api/shadermap4/preview/<filename>` (GET)
Get shader preview image

#### `/api/shadermap4/health` (GET)
Service health check

## Supported Materials & Presets

### Materializer Presets
- **wood** - Natural wood with realistic grain patterns
- **metal** - Metallic surfaces with proper reflectivity
- **stone** - Rock and stone materials with natural variation
- **fabric** - Cloth and textile patterns
- **plastic** - Synthetic plastic materials
- **ceramic** - Ceramic and pottery textures
- **leather** - Leather material generation
- **rubber** - Rubber and silicone textures

### ShaderMap 4 Templates
- **pbr_metallic** - PBR shader with metallic properties
- **pbr_roughness** - PBR with detailed roughness control
- **standard_diffuse** - Simple diffuse shader
- **substance_advanced** - Substance Designer compatible
- **custom_nodes** - Fully customizable node graph

## Configuration

### Environment Variables

```bash
# Materializer
export MATERIALIZER_SERVICE_PORT=8011
export MATERIALIZER_WORK_DIR=/path/to/materializer_work

# ShaderMap 4
export SHADERMAP4_SERVICE_PORT=8012
export SHADERMAP4_WORK_DIR=/path/to/shadermap4_work
```

### Default Settings
- **Materializer Port**: 8011
- **ShaderMap4 Port**: 8012
- **Work Directories**: `./materializer_work` and `./shadermap4_work`

## File Formats

### Materializer Output
- **PNG** (default, 8-bit or 16-bit)
- **EXR** (high dynamic range)
- **JPG** (lossy compression)

### ShaderMap 4 Output
- **sm4** (ShaderMap 4 native format)
- **sbsar** (Substance format)
- **custom** (Custom node format)
- Includes preview PNG and node graph JSON

## Performance

### Processing Times (Approximate)

**Materializer**:
- Diffuse generation: 10-30s
- Full PBR suite: 30-60s
- With AI enhancement: +20-30s

**ShaderMap 4**:
- Draft quality: 30s
- Standard quality: 1-2 min
- High quality: 2-5 min
- Ultra quality: 5-10 min

### Quality Recommendations
- **Web/Mobile**: Draft or Standard
- **Game Engines**: High quality
- **Cinematic**: Ultra quality
- **Real-time**: High with optimization

## Troubleshooting

### Service Won't Start
1. Check ports are available (8011, 8012)
2. Verify Python and dependencies installed
3. Check logs for errors
4. Ensure work directories are writable

### Generation Fails
1. Verify image format is supported (PNG, JPG, BMP)
2. Check image dimensions (typically 512px minimum)
3. Ensure adequate disk space
4. Try lowering quality level

### Large File Downloads
1. Check network connection
2. Verify download folder has write permissions
3. Ensure adequate disk space
4. Try downloading individual files instead of batch

## Integration Examples

### Generate PBR Textures for Game Asset
```typescript
import { generateTextures } from '@/utils/materializer';

const file = /* input image file */;
const { textures, id } = await generateTextures(
  file,
  'pbr',        // Full PBR suite
  true,         // AI enhancement
  'metal'       // Metal preset
);

// Download all textures
for (const texture of textures) {
  await downloadTexture(texture.id, `${texture.mode}_${texture.id}.png`);
}
```

### Create Custom Shader
```typescript
import { generateShaders } from '@/utils/shadermap4';

const file = /* reference image */;
const { shaders, id } = await generateShaders(
  file,
  'custom',     // Fully customizable
  'high',       // High quality
  'custom_nodes' // Empty template
);
```

## Advanced Usage

### Batch Processing
1. Use `/api/materializer/download-all` for bulk texture generation
2. Process multiple images sequentially
3. Organize outputs by material type

### Shader Graph Inspection
1. Download shader ZIP contains `shader_*.json`
2. JSON includes complete node graph structure
3. Modify and re-upload for custom workflows

### Integration with Game Engines
- Export textures directly to project folders
- Shader JSON can be parsed for engine-specific formats
- Preview images suitable for thumbnail generation

## Performance Tips

1. **Image Size**: Optimal 512x512 to 2048x2048 pixels
2. **Quality Levels**: Use draft for iteration, high for final
3. **Batch Operations**: Download multiple at once
4. **Cleanup**: Regularly clear old work directories
5. **Caching**: Services cache presets and templates

## Security Considerations

1. **File Upload**: Validates image format
2. **Path Traversal**: Work directories isolated
3. **File Size**: No explicit limit, filesystem limits apply
4. **CORS**: Enabled for local development

## Future Enhancements

- [ ] Real-time preview in editor
- [ ] Texture painting interface
- [ ] Shader node graph editor
- [ ] Multi-layer material support
- [ ] Cloud-based processing
- [ ] AI model training
- [ ] Batch processing UI
- [ ] Material library management
- [ ] Integration with popular engines (Unreal, Unity)
- [ ] Advanced post-processing options

## References

- [NVIDIA Materializer Documentation](https://developer.nvidia.com)
- [ShaderMap Documentation](https://www.shadermap.com)
- Flask: https://flask.palletsprojects.com/
- Pillow: https://python-pillow.org/
- Node Graph Architecture: https://en.wikipedia.org/wiki/Node_graph

## License

Integration follows the same license as Mossy Desktop AI.
