import React, { useState } from 'react';
import { SceneConfig } from '../../types/vca';

interface SceneSelectorProps {
    onSceneSelect: (scene: SceneConfig) => void;
}

const PRESET_SCENES: SceneConfig[] = [
    {
        id: 'scene_beach',
        name: 'Coastal Beach House',
        prompt_template: 'A bright, airy coastal living room with {{ product.name }} near a large window overlooking the ocean.',
        is_custom: false
    },
    {
        id: 'scene_loft',
        name: 'Industrial Loft',
        prompt_template: 'A modern industrial loft with brick walls and concrete floors, featuring {{ product.name }} as a focal point.',
        is_custom: false
    },
    {
        id: 'scene_minimal',
        name: 'Minimalist Studio',
        prompt_template: 'A clean, high-key minimalist studio background with soft shadows, highlighting the {{ product.name }}.',
        is_custom: false
    }
];

export const SceneSelector: React.FC<SceneSelectorProps> = ({ onSceneSelect }) => {
    const [customPrompt, setCustomPrompt] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const handleSelect = (scene: SceneConfig) => {
        setSelectedId(scene.id);
        onSceneSelect(scene);
    };

    const handleCustomSubmit = () => {
        const customScene: SceneConfig = {
            id: 'custom_' + Date.now(),
            name: 'Custom User Scene',
            prompt_template: customPrompt,
            is_custom: true
        };
        handleSelect(customScene);
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Select Contextual Scene</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PRESET_SCENES.map(scene => (
                    <div
                        key={scene.id}
                        onClick={() => handleSelect(scene)}
                        className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${selectedId === scene.id
                                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                    >
                        <div className="font-medium text-gray-900">{scene.name}</div>
                        <div className="text-xs text-gray-500 mt-2 line-clamp-3 italic">
                            "{scene.prompt_template}"
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Or write your own prompt:</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={customPrompt}
                        onChange={e => setCustomPrompt(e.target.value)}
                        placeholder="e.g. A cozy library with warm lighting..."
                        className="flex-1 border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                        onClick={handleCustomSubmit}
                        className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 transition"
                    >
                        Set Custom
                    </button>
                </div>
            </div>
        </div>
    );
};
