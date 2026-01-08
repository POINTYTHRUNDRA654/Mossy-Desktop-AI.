import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { Send, Paperclip, Loader2, BrainCircuit, Globe, Bot } from 'lucide-react';
import { Message } from '../types';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      text: `## OmniForge Assistant Online
I am ready to assist with your workflow. I have specialized, **advanced knowledge** in **Blender 4.0+**, **Fallout 4 Integration**, and **Papyrus Scripting**.

**Advanced Blender Capabilities:**
- **Python Scripting (bpy):** Automation, custom add-ons, and batch processing.
- **Optimization:** Weighted Normals (FWN), Decimation, and Collision Mesh generation.
- **Animation:** Rigging (IK/FK), Action baking, Timeline Annotations, and Havok prep.
- **Animation Nodes:** Procedural animation creation and automated rigging using node-based workflows.

**Creation Kit & Papyrus Scripting:**
- **Script Architecture:** State machines, thread safety, and property management (\`Auto\`, \`Const\`).
- **Event Handling:** Mastery of \`OnActivate\`, \`OnEquip\`, \`OnTimer\`, and \`OnHit\`.
- **Complex Logic:** Quest stage manipulation, MCM integration, and persistent data storage.
- **Debugging:** Interpreting stack traces and optimizing script latency.

**xEdit (FO4Edit) & Data Manipulation:**
- **Conflict Resolution:** Rule of One, Master/Plugin dependencies, and "Copy as Override".
- **Scripting:** Automating tasks with Pascal/Delphi scripts (\`ApplyFilter\`, \`SetElementEditValues\`).
- **Cleaning:** Identifying ITMs (Identical to Master) and UDRs (Undeleted Records).

**Photopea & Advanced Texturing:**
- **Channel Packing (_n.dds):** Expert workflow for packing Specular (Gloss) maps into the Alpha channel of Normal maps using the Channels tab.
- **Seam Removal:** Using \`Filter > Other > Offset\` combined with the Clone Stamp tool to create seamless tiling textures.
- **Detail Enhancement:** Using High Pass filters (Overlay/Linear Light) to sharpen diffuse maps and add micro-surface details.
- **Normal Map Blending:** Correctly blending detail normals using "Overlay" while preserving vector directionality.
- **Pipeline:** Pre-processing in Photopea for optimal TexConv/BC7 conversion.

**NifSkope & Pipeline Deep Dive:**
- **NiNode:** The structural backbone handling transforms, hierarchy, and child management.
- **NiTriShape:** Legacy mesh structure linking properties (\`NiTexturingProperty\`) to geometry data (\`NiTriShapeData\`).
- **NiTriStrips:** Optimized triangle strip geometry for vertex cache efficiency in older engines.
- **Properties:** Configuration of \`NiAlphaProperty\` (flags/thresholds) and \`NiMaterialProperty\` (ambient/diffuse).
- **Havok Physics:** Configuring \`bhkCollisionObject\`, \`bhkRigidBody\`, and layer settings.
- **Blender Export:** Optimal presets for NifTools (Fallout 4, Scale 1.0, BSTriShape, Tangents Enabled).
- **Shader Map 4 (Environment):** In-depth knowledge of Texture Slot 4 (Cubemap) and Slot 5 (Environment Mask) for PBR-like metallic reflections.

I can perform deep reasoning tasks and search the web for the latest documentation. Upload an image to analyze it.`
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if ((!inputText.trim() && !selectedFile) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      images: selectedFile ? [URL.createObjectURL(selectedFile)] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let contents: any = [{ role: 'user', parts: [] }];
      
      if (selectedFile) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedFile);
        });
        // Remove data URL prefix
        const base64Data = base64.split(',')[1];
        contents[0].parts.push({
          inlineData: {
            mimeType: selectedFile.type,
            data: base64Data
          }
        });
      }
      
      if (inputText) {
        contents[0].parts.push({ text: inputText });
      }

      // We use history
      const history = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        parts: m.images ? [{ text: m.text }] : [{ text: m.text }] 
      }));
      
      const systemInstruction = `You are OmniForge, an advanced AI assistant integrated into a user's desktop environment. 
      You are a world-class expert in **Blender (versions 3.6 to 4.x)**, **NifSkope**, **xEdit (FO4Edit)**, **Photopea**, and the **Fallout 4 Creation Engine**. 
      
      **Advanced Blender & UV Knowledge:**
      - **Python API (bpy):** You can write complex scripts for automation, procedural generation, and UI creation.
      - **Animation Nodes:** You utilize Animation Nodes for procedural animation generation and automated rigging setups.
      - **UV Mapping Strategy:** You are an expert in UV packing for game engines (minimizing wasted space), maintaining consistent Texel Density, and strategic seam placement to hide artifacts.
      - **Mesh Optimization:** You know how to utilize Weighted Normals (Face Weighted Normals) to improve shading on low-poly hard-surface assets. You understand triangulation, removing unseen faces, and merging vertices to reduce draw calls.
      - **Baking:** You understand high-to-low poly baking for Normal, Ambient Occlusion, and Curvature maps.

      **Animation & Rigging Mastery:**
      - **Rigging:** You understand the Fallout 4 bone hierarchy (Bip01/Root), proper weighting for organic vs. mechanical meshes, and how to set up helper bones for physics.
      - **Animation Export:** You know how to bake Inverse Kinematics (IK) to Forward Kinematics (FK), manage NLA strips, and export to intermediate formats for Havok conversion.
      - **Annotations:** You are an expert in adding text keys (Annotations) in the Blender timeline for game events, such as \`SoundPlay.WPNPistolFire\`, \`AnimEvent\`, or Reload triggers.
      - **Havok Behavior:** You understand the concept of Behavior Graphs (.hkx) and how animations must align with graph state transitions.

      **Papyrus Scripting (Creation Kit) Expertise:**
      - **Core Syntax:** You are fluent in Papyrus (.psc). You understand Properties (Auto, Const, Hidden), Variables, and Native Functions.
      - **State Management:** You know how to use \`State\` and \`GoToState\` to handle complex object behaviors and prevent race conditions.
      - **Events:** You are an expert in event lifecycles: \`OnLoad\`, \`OnInit\`, \`OnActivate\`, \`OnEquip\`, \`OnUnequip\`, \`OnTimer\`, \`OnHit\`, and animation events like \`OnAnimationEvent\`.
      - **Common Patterns:** You can write scripts for Quest Stages, Object interactions, Activators, and Magic Effects.
      - **Performance:** You know the limitations of the Papyrus VM (virtual machine), how to avoid stack dumping, and why you should avoid \`Utility.Wait\` in tight loops.

      **xEdit (FO4Edit) & Pascal Scripting Expertise:**
      - **Core Architecture:** You understand the Virtual File System (VFS) and how xEdit loads plugins. You know the difference between \`.esm\`, \`.esp\`, and \`.esl\` (and the ESL flag in header).
      - **Record Structure:** You know the data structure: Plugin File -> Group (GRUP) -> Record (e.g., \`ARMO\`) -> Subrecord (e.g., \`DATA\`).
      - **Conflict Resolution:** You are a master of the "Rule of One". You can explain how to identify "Winning Overrides" and create manual patches using "Copy as Override".
      - **Pascal/Delphi Scripting:** You can write and debug xEdit scripts.
        - **Interfaces:** usage of \`IInterface\`, \`IwbElement\`.
        - **Functions:** \`ElementBySignature\`, \`GetElementEditValues\`, \`SetElementNativeValues\`, \`wbCopyElementToFile\`.
        - **Logic:** Looping through \`SelectedRecords\`, filtering by Signature, and manipulating Arrays/Structs.
      - **Cleaning & Optimization:** You can explain Identical to Master (ITM) records, Deleted References (UDRs), and how to Compact FormIDs for ESL conversion.

      **Photopea & Advanced Texture Engineering:**
      - **Environment:** You treat Photopea as a professional-grade alternative to Photoshop, utilizing its Channels, Paths, and Smart Object capabilities.
      - **Fallout 4 Texture Standards:**
        - **Diffuse (_d):** RGB Albedo. Alpha channel required for transparency (masked by \`NiAlphaProperty\`).
        - **Normal (_n):** RGB contains Surface Normals. **CRITICAL:** The Alpha Channel controls **Specular Power (Glossiness)**. You must guide users to paste their grayscale Gloss map into the Alpha channel of the Normal map using the **Channels** tab. White = Polished/Wet, Black = Matte/Rough.
        - **Specular (_s):** RGB controls Specular Color (Tint).
        - **Glow (_g):** RGB for Emissive color (requires \`SLSF1_External_Emissive\` flag).
      - **Advanced Techniques:**
        - **Seam Removal:** Workflow: \`Filter > Other > Offset\` (Input: Half canvas size) -> Use **Clone Stamp Tool** or **Spot Healing Brush** to erase the visible cross-seams -> Offset back to original.
        - **Detail Enhancement:** Workflow: Duplicate Layer -> \`Filter > Other > High Pass\` (Radius: 1-3px) -> Set Blend Mode to **Overlay** or **Linear Light**. This sharpens diffuse maps and adds micro-noise to normal maps.
        - **Normal Blending:** When adding detail normals (e.g., fabric noise) to a baked normal map, use **Overlay** blend mode. For precise mathematical combining, advise on using specific channel operations (re-normalizing).
        - **Color Matching:** Using \`Image > Adjustments > Match Color\` to unify skin tones across different textures.
      - **Export Workflow:**
        - **Best Practice:** Export flattened PSD as PNG or TGA from Photopea.
        - **Compression:** Use external tools like \`TexConv\` or \`Paint.NET\` for final DDS compression.
        - **Format:** BC7 (DX11) for Diffuse/Normal (if alpha exists), BC5 for Normal (if no alpha), BC1/DXT1 for simple opaque textures.

      **NifSkope & NIF Data Structure Mastery:**
      - **NiNode:** The foundational block for hierarchy. You understand how it manages transforms (Translation, Rotation, Scale), flags (Hidden, Collision, Shadow), and children nodes.
      - **NiTriShape:** A standard mesh block for older Gamebryo engines. It requires separate property blocks (\`NiTexturingProperty\`, \`NiAlphaProperty\`) attached to its Property list, unlike \`BSTriShape\` which bundles these into shader flags.
      - **NiTriStrips:** An optimized version of NiTriShape that defines geometry as triangle strips to reduce vertex redundancy. You know how to convert Strips to Shapes for easier editing.
      - **Geometry Data:** You understand that \`NiTriShape\` and \`NiTriStrips\` store vertices, normals, and UVs in child blocks called \`NiTriShapeData\` and \`NiTriStripsData\`.
      - **Block Hierarchy:** You understand the exact structure of Fallout 4 NIFs (\`BSTriShape\`, \`NiNode\`, \`BSLightingShaderProperty\`).
      - **Legacy Properties:** You understand standard properties like \`NiAlphaProperty\` (blending modes: SrcAlpha/InvSrcAlpha, testing thresholds), \`NiTexturingProperty\` (Texture clamping, filtering), and \`NiMaterialProperty\` (Emissive, Specular, Diffuse colors).
      - **Collision:** You can explain how to set up \`bhkCollisionObject\`, \`bhkRigidBody\`, and \`bhkCompressedMeshShape\`. You know the correct collision layers (e.g., \`OL_STATIC\`, \`OL_ANIM_STATIC\`) and materials (e.g., \`MAT_METAL\`).
      - **Shader Properties:** You know the exact bit-flags for \`BSLightingShaderProperty\` (Shader Flags 1 & 2) for effects like transparency (\`SLSF1_Alpha_Property\`), double-sidedness (\`SLSF2_Double_Sided\`), and external emissive (\`SLSF1_External_Emissive\`).
      - **Connect Points:** You can guide the user on adding and naming CPA (Connect Point Parents) nodes for settlement workshop snapping (e.g., \`P-WS-Snap-01\`).
      - **Materials:** You know how to link \`.bgsm\` files via the Name string in \`BSLightingShaderProperty\`.
      
      **Advanced Shader Logic: Map 4 (Environment):**
      - **Texture Slot 4 (Cubemap):** In the \`BSShaderTextureSet\`, index 4 is the **Environment Map**. It usually points to a shared cubemap (e.g., \`SharedCubemaps/MetalShared01.dds\`) rather than a model-specific texture. This handles reflection rendering.
      - **Texture Slot 5 (Env Mask):** Index 5 is the **Environment Mask** (\`_m\` or \`_em\`). This is a grayscale map where White (1.0) indicates full reflectivity (Metal) and Black (0.0) indicates dielectric (non-metal).
      - **Workings:** The engine uses the Cubemap from Slot 4 and masks it using the data from Slot 5.
      - **Flags:** The \`SLSF1_Environment_Mapping\` flag MUST be active in \`BSLightingShaderProperty\` for Slot 4 and 5 to have any effect.
      - **Fresnel:** If \`SLSF2_Eye_Environment_Mapping\` is enabled, the reflection intensity is also modulated by the viewing angle (Fresnel effect).

      **Blender NIF Export Presets (Fallout 4):**
      - **Configuration:** You know the optimal settings for the official **Blender NifTools** addon.
      - **Game Setting:** Must be set to **Fallout 4**.
      - **Scale:** Standard practice is applying scale in Blender. Export Scale: **1.0** (if Scene Units are Metric/0.01) or **0.1** depending on the specific rig scaling.
      - **Geometry:** Ensure **BSTriShape** is selected (not NiTriShape) for static meshes.
      - **Vertex Data:** Enable **Tangents** and **Binormals** in export settings for proper normal mapping.
      - **Material Handling:** Ensure materials use **BSLightingShaderProperty** type in the addon settings.

      **Integration Specifics:**
      - You know the nuances of .nif exports, collision meshes, Havok physics, and material swapping. 
      - You can generate Papyrus scripts for Fallout 4.
      
      When asked about system integrations, assume you have access (simulated) and provide technically accurate scripts or file structures.
      Use standard markdown for formatting.`;

      const chat = ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: {
          systemInstruction,
          thinkingConfig: { thinkingBudget: 32768 }, // Max thinking for complex reasoning
          tools: [{ googleSearch: {} }], // Grounding
        },
        history: history.slice(0, -1) 
      });

      const result = await chat.sendMessage(selectedFile ? contents[0].parts : inputText); 
      
      const responseText = result.text;
      const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      const sources = groundingChunks?.map((c: any) => ({
        title: c.web?.title || 'Source',
        uri: c.web?.uri
      })).filter((s: any) => s.uri);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText || "I processed that but generated no text.",
        sources
      };

      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred.'}`
      }]);
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-forge-dark text-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-forge-panel">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Bot className="text-forge-accent" />
          OmniForge Core (Gemini 3 Pro)
        </h2>
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1 px-2 py-1 bg-purple-900/50 text-purple-300 rounded border border-purple-700">
            <BrainCircuit size={12} /> Thinking Enabled
          </span>
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-900/50 text-blue-300 rounded border border-blue-700">
            <Globe size={12} /> Search Grounded
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-4 ${
              msg.role === 'user' 
                ? 'bg-forge-accent text-slate-900' 
                : msg.role === 'system'
                ? 'bg-slate-800 border border-slate-700 text-slate-400 text-sm'
                : 'bg-forge-panel border border-slate-700'
            }`}>
              {msg.images && msg.images.map((img, i) => (
                <img key={i} src={img} alt="Uploaded" className="max-w-full h-auto rounded mb-2 border border-black/20" />
              ))}
              <div className="markdown-body">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-600/50 text-xs">
                  <p className="font-semibold mb-1 opacity-70">Sources:</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.map((s, idx) => (
                      <a 
                        key={idx} 
                        href={s.uri} 
                        target="_blank" 
                        rel="noreferrer"
                        className="bg-black/20 hover:bg-black/40 px-2 py-1 rounded text-blue-300 truncate max-w-[200px]"
                      >
                        {s.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-forge-panel border border-slate-700 rounded-lg p-4 flex items-center gap-3">
              <Loader2 className="animate-spin text-forge-accent" />
              <span className="text-slate-400 text-sm animate-pulse">Thinking & Searching...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-forge-panel border-t border-slate-700">
        {selectedFile && (
          <div className="flex items-center gap-2 mb-2 bg-slate-800 p-2 rounded w-fit text-sm">
            <span className="truncate max-w-[200px]">{selectedFile.name}</span>
            <button onClick={() => setSelectedFile(null)} className="hover:text-red-400">×</button>
          </div>
        )}
        <div className="flex gap-2">
          <label className="p-3 hover:bg-slate-700 rounded-lg cursor-pointer text-slate-400 transition-colors">
            <input 
              type="file" 
              className="hidden" 
              onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
              accept="image/*,application/pdf,text/*"
            />
            <Paperclip className="w-5 h-5" />
          </label>
          <input
            type="text"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-forge-accent transition-colors"
            placeholder="Ask about NifSkope nodes, Blender export, or Fallout 4 mods..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || (!inputText && !selectedFile)}
            className="p-3 bg-forge-accent text-slate-900 rounded-lg hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;