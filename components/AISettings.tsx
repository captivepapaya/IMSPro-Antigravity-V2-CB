import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Save, Check } from 'lucide-react';
import { getSetting, saveSetting } from '../services/db';

interface AISettingsProps {
    onClose?: () => void;
}

export const AISettings: React.FC<AISettingsProps> = ({ onClose }) => {
    // API Provider
    const [apiProvider, setApiProvider] = useState<'ai_studio' | 'vertex'>('ai_studio');

    // API Keys
    const [aiStudioKey, setAiStudioKey] = useState('');
    const [vertexKey, setVertexKey] = useState('');
    const [replicateKey, setReplicateKey] = useState('');

    // Vertex Config
    const [vertexProjectId, setVertexProjectId] = useState('');
    const [vertexLocation, setVertexLocation] = useState('us-central1');

    // Model Selection
    const [imageGenModel, setImageGenModel] = useState('gemini-3-pro-image-preview');
    const [bgRemovalModel, setBgRemovalModel] = useState('lucataco/remove-bg');

    // Replicate Model Parameters
    const [aspectRatio, setAspectRatio] = useState('match_input_image');
    const [outputFormat, setOutputFormat] = useState('jpg');
    const [resolution, setResolution] = useState('2K');
    const [safetyFilterLevel, setSafetyFilterLevel] = useState('block_only_high');

    // Visibility toggles
    const [showAiStudioKey, setShowAiStudioKey] = useState(false);
    const [showVertexKey, setShowVertexKey] = useState(false);
    const [showReplicateKey, setShowReplicateKey] = useState(false);

    // Save status
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Load settings on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const provider = await getSetting('ai_provider') || 'ai_studio';
            const aiKey = await getSetting('google_api_key') || '';
            const vKey = await getSetting('google_vertex_key') || '';
            const repKey = await getSetting('replicate_api_key') || '';
            const vProjectId = await getSetting('google_project_id') || '';
            const vLoc = await getSetting('google_vertex_location') || 'us-central1';
            const imgModel = await getSetting('ai_image_gen_model') || 'gemini-3-pro-image-preview';
            const bgModel = await getSetting('ai_bg_removal_model') || 'lucataco/remove-bg';

            // Load Replicate parameters
            const aspect = await getSetting('replicate_aspect_ratio') || 'match_input_image';
            const format = await getSetting('replicate_output_format') || 'jpg';
            const res = await getSetting('replicate_resolution') || '2K';
            const safety = await getSetting('replicate_safety_filter') || 'block_only_high';

            setApiProvider(provider);
            setAiStudioKey(aiKey);
            setVertexKey(vKey);
            setReplicateKey(repKey);
            setVertexProjectId(vProjectId);
            setVertexLocation(vLoc);
            setImageGenModel(imgModel);
            setBgRemovalModel(bgModel);
            setAspectRatio(aspect);
            setOutputFormat(format);
            setResolution(res);
            setSafetyFilterLevel(safety);
        } catch (error) {
            console.error('Failed to load AI settings:', error);
        }
    };

    const handleSave = async () => {
        setSaveStatus('saving');
        console.log('💾 Saving AI Settings:', {
            imageGenModel,
            replicateKey: replicateKey ? '***' : 'missing',
            aspectRatio,
            resolution
        });

        try {
            await saveSetting('ai_provider', apiProvider);
            await saveSetting('google_api_key', aiStudioKey);
            await saveSetting('google_vertex_key', vertexKey);
            await saveSetting('replicate_api_key', replicateKey);
            await saveSetting('google_project_id', vertexProjectId);
            await saveSetting('google_vertex_location', vertexLocation);
            await saveSetting('ai_image_gen_model', imageGenModel); // <--- This is the key one
            await saveSetting('ai_bg_removal_model', bgRemovalModel);

            // Save Replicate parameters
            await saveSetting('replicate_aspect_ratio', aspectRatio);
            await saveSetting('replicate_output_format', outputFormat);
            await saveSetting('replicate_resolution', resolution);
            await saveSetting('replicate_safety_filter', safetyFilterLevel);

            console.log('✅ Settings Saved. Reloading verification...');

            // Force reload to verify persistence
            await loadSettings();

            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error('Failed to save AI settings:', error);
            setSaveStatus('idle');
            alert('Failed to save settings');
        }
    };

    const imageGenModels = [
        { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
        { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image Preview' },
        { value: 'replicate:google/nano-banana', label: 'Nano Banana (Replicate)' },
        { value: 'replicate:google/nano-banana-pro', label: 'Nano Banana Pro (Replicate)' }
    ];

    const bgRemovalModels = [
        { value: 'lucataco/remove-bg', label: 'Lucataco Remove BG' },
        { value: '851-labs/background-remover', label: '851 Labs Background Remover' }
    ];

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">AI Configuration</h2>

            {/* API Provider Selection */}
            <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-semibold text-gray-700 mb-3">API Provider</label>
                <div className="flex gap-4">
                    <button
                        onClick={() => setApiProvider('ai_studio')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${apiProvider === 'ai_studio'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400'
                            }`}
                    >
                        AI Studio
                    </button>
                    <button
                        onClick={() => setApiProvider('vertex')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${apiProvider === 'vertex'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400'
                            }`}
                    >
                        Vertex AI
                    </button>
                </div>
            </div>

            {/* AI Studio API Key */}
            <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    AI Studio API Key
                </label>
                <div className="flex gap-2">
                    <input
                        type={showAiStudioKey ? 'text' : 'password'}
                        value={aiStudioKey}
                        onChange={(e) => setAiStudioKey(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                        placeholder="AIzaSy..."
                    />
                    <button
                        onMouseDown={() => setShowAiStudioKey(true)}
                        onMouseUp={() => setShowAiStudioKey(false)}
                        onMouseLeave={() => setShowAiStudioKey(false)}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                        {showAiStudioKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Vertex AI Configuration */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Vertex AI Configuration</h3>

                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Vertex API Key / OAuth Token
                    </label>
                    <div className="flex gap-2">
                        <input
                            type={showVertexKey ? 'text' : 'password'}
                            value={vertexKey}
                            onChange={(e) => setVertexKey(e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                            placeholder="ya29...."
                        />
                        <button
                            onMouseDown={() => setShowVertexKey(true)}
                            onMouseUp={() => setShowVertexKey(false)}
                            onMouseLeave={() => setShowVertexKey(false)}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                        >
                            {showVertexKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Project ID
                        </label>
                        <input
                            type="text"
                            value={vertexProjectId}
                            onChange={(e) => setVertexProjectId(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                            placeholder="my-project-id"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Location
                        </label>
                        <input
                            type="text"
                            value={vertexLocation}
                            onChange={(e) => setVertexLocation(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                            placeholder="us-central1"
                        />
                    </div>
                </div>
            </div>

            {/* Replicate API Key */}
            <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Replicate API Token
                </label>
                <div className="flex gap-2">
                    <input
                        type={showReplicateKey ? 'text' : 'password'}
                        value={replicateKey}
                        onChange={(e) => setReplicateKey(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                        placeholder="r8_..."
                    />
                    <button
                        onMouseDown={() => setShowReplicateKey(true)}
                        onMouseUp={() => setShowReplicateKey(false)}
                        onMouseLeave={() => setShowReplicateKey(false)}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                        {showReplicateKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Model Selection */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Model Selection</h3>

                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Image Generation Model
                    </label>
                    <select
                        value={imageGenModel}
                        onChange={(e) => setImageGenModel(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                    >
                        {imageGenModels.map(model => (
                            <option key={model.value} value={model.value}>
                                {model.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Background Removal Model
                    </label>
                    <select
                        value={bgRemovalModel}
                        onChange={(e) => setBgRemovalModel(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                    >
                        {bgRemovalModels.map(model => (
                            <option key={model.value} value={model.value}>
                                {model.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Replicate Model Parameters - Only show for Replicate models */}
                {imageGenModel.startsWith('replicate:') && (
                    <div className="mt-6 pt-6 border-t border-gray-300">
                        <h4 className="text-md font-semibold text-gray-800 mb-4">Replicate Model Parameters</h4>

                        {/* Aspect Ratio - Both models */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Aspect Ratio
                            </label>
                            <select
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                            >
                                <option value="match_input_image">Match Input Image</option>
                                <option value="1:1">1:1 (Square)</option>
                                <option value="2:3">2:3</option>
                                <option value="3:2">3:2</option>
                                <option value="3:4">3:4</option>
                                <option value="4:3">4:3</option>
                                <option value="4:5">4:5</option>
                                <option value="5:4">5:4</option>
                                <option value="9:16">9:16 (Portrait)</option>
                                <option value="16:9">16:9 (Landscape)</option>
                                <option value="21:9">21:9 (Ultrawide)</option>
                            </select>
                        </div>

                        {/* Output Format - Both models */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Output Format
                            </label>
                            <select
                                value={outputFormat}
                                onChange={(e) => setOutputFormat(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                            >
                                <option value="jpg">JPG</option>
                                <option value="png">PNG</option>
                            </select>
                        </div>

                        {/* Pro-only parameters */}
                        {imageGenModel.includes('nano-banana-pro') && (
                            <>
                                {/* Resolution - Pro only */}
                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Resolution
                                    </label>
                                    <select
                                        value={resolution}
                                        onChange={(e) => setResolution(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                                    >
                                        <option value="1K">1K</option>
                                        <option value="2K">2K</option>
                                        <option value="4K">4K</option>
                                    </select>
                                </div>

                                {/* Safety Filter Level - Pro only */}
                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Safety Filter Level
                                    </label>
                                    <select
                                        value={safetyFilterLevel}
                                        onChange={(e) => setSafetyFilterLevel(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                                    >
                                        <option value="block_low_and_above">Block Low and Above (Strictest)</option>
                                        <option value="block_medium_and_above">Block Medium and Above</option>
                                        <option value="block_only_high">Block Only High (Default)</option>
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-4">
                <button
                    onClick={handleSave}
                    disabled={saveStatus === 'saving'}
                    className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${saveStatus === 'saved'
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {saveStatus === 'saved' ? (
                        <>
                            <Check className="w-5 h-5" />
                            Saved
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            {saveStatus === 'saving' ? 'Saving...' : 'Save Settings'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
