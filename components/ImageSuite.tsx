import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Image as ImageIcon, Wand2, ScanSearch, Download, Trash2 } from 'lucide-react';

const ImageSuite: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');
  const [prompt, setPrompt] = useState('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState({
    size: '1K',
    aspectRatio: '1:1'
  });
  
  // For editing
  const [sourceImage, setSourceImage] = useState<File | null>(null);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsLoading(true);
    try {
      // Must check key for Pro Image
      if (activeTab === 'generate') {
         // Assuming key is selected or environment variable is valid
         // The prompt requirement says users MUST select their own API key for Pro Image.
         if (window.aistudio && !window.aistudio.hasSelectedApiKey()) {
             await window.aistudio.openSelectKey();
         }
         
         // Re-init with potentially new key (though we rely on env var injection usually, 
         // but for client-side key selection in this hypothetical environment):
         // The instructions say "Create a new GoogleGenAI instance right before making an API call"
         const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
         
         const response = await ai.models.generateContent({
             model: 'gemini-3-pro-image-preview',
             contents: { parts: [{ text: prompt }] },
             config: {
                 imageConfig: {
                     aspectRatio: config.aspectRatio,
                     imageSize: config.size
                 }
             }
         });
         
         // Extract image
         for (const part of response.candidates?.[0]?.content?.parts || []) {
             if (part.inlineData) {
                 setResultImage(`data:image/png;base64,${part.inlineData.data}`);
                 break;
             }
         }

      } else if (activeTab === 'edit' && sourceImage) {
        // Nano Banana powered app (Gemini 2.5 Flash Image)
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(sourceImage);
        });
        const base64Data = base64.split(',')[1];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: sourceImage.type, data: base64Data } },
                    { text: prompt }
                ]
            }
        });

         for (const part of response.candidates?.[0]?.content?.parts || []) {
             if (part.inlineData) {
                 setResultImage(`data:image/png;base64,${part.inlineData.data}`);
                 break;
             }
         }
      }

    } catch (e) {
      console.error(e);
      alert("Operation failed. See console.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-forge-dark text-slate-200">
      <div className="flex border-b border-slate-700 bg-forge-panel">
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium ${activeTab === 'generate' ? 'border-b-2 border-forge-accent text-forge-accent' : 'text-slate-400 hover:text-white'}`}
        >
          <ImageIcon className="w-5 h-5" /> Generator (Pro)
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium ${activeTab === 'edit' ? 'border-b-2 border-forge-accent text-forge-accent' : 'text-slate-400 hover:text-white'}`}
        >
          <Wand2 className="w-5 h-5" /> Editor (Flash)
        </button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Controls */}
          <div className="space-y-6">
            <div className="bg-forge-panel p-6 rounded-xl border border-slate-700">
              <h3 className="text-xl font-bold mb-4 text-white">
                {activeTab === 'generate' ? 'Create New Image' : 'Edit Existing Image'}
              </h3>
              
              {activeTab === 'edit' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-400 mb-2">Source Image</label>
                  <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:border-forge-accent cursor-pointer transition-colors relative">
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept="image/*"
                      onChange={(e) => e.target.files && setSourceImage(e.target.files[0])}
                    />
                    {sourceImage ? (
                      <div className="text-forge-accent font-medium">{sourceImage.name}</div>
                    ) : (
                      <div className="text-slate-500">Drag & drop or click to upload</div>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-400 mb-2">Prompt</label>
                <textarea
                  className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-forge-accent resize-none"
                  placeholder={activeTab === 'generate' 
                    ? "A futuristic fallout shelter with neon lights, 4k render..." 
                    : "Add a red skateboard to the robot..."}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              {activeTab === 'generate' && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Aspect Ratio</label>
                    <select 
                      value={config.aspectRatio}
                      onChange={(e) => setConfig({...config, aspectRatio: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2"
                    >
                      <option value="1:1">1:1 (Square)</option>
                      <option value="16:9">16:9 (Landscape)</option>
                      <option value="9:16">9:16 (Portrait)</option>
                      <option value="4:3">4:3</option>
                      <option value="3:4">3:4</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Quality</label>
                    <select 
                      value={config.size}
                      onChange={(e) => setConfig({...config, size: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2"
                    >
                      <option value="1K">1K (Standard)</option>
                      <option value="2K">2K (High)</option>
                      <option value="4K">4K (Ultra)</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isLoading || !prompt || (activeTab === 'edit' && !sourceImage)}
                className="w-full py-3 bg-forge-accent text-slate-900 font-bold rounded-lg hover:bg-sky-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? <ScanSearch className="animate-spin" /> : (activeTab === 'generate' ? <ImageIcon /> : <Wand2 />)}
                {isLoading ? 'Processing...' : (activeTab === 'generate' ? 'Generate' : 'Apply Edits')}
              </button>
            </div>
            
            <div className="text-xs text-slate-500 text-center">
              Uses {activeTab === 'generate' ? 'Gemini 3 Pro Image Preview' : 'Gemini 2.5 Flash Image'}
            </div>
          </div>

          {/* Result */}
          <div className="bg-black/50 rounded-xl border border-slate-800 flex items-center justify-center p-2 relative min-h-[400px]">
             {resultImage ? (
               <div className="relative group w-full h-full flex items-center justify-center">
                 <img src={resultImage} alt="Generated" className="max-w-full max-h-[600px] rounded shadow-2xl object-contain" />
                 <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={resultImage} download="omniforge-art.png" className="p-2 bg-white text-black rounded-full hover:bg-slate-200">
                      <Download className="w-5 h-5" />
                    </a>
                    <button onClick={() => setResultImage(null)} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                      <Trash2 className="w-5 h-5" />
                    </button>
                 </div>
               </div>
             ) : (
               <div className="text-slate-600 flex flex-col items-center">
                 <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                 <p>Output will appear here</p>
               </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ImageSuite;
