import React from 'react';
import { Delete, X, Check } from 'lucide-react';

interface AlphanumericKeypadProps {
    onInput: (char: string) => void;
    onDelete: () => void;
    onEnter: () => void;
    onClose: () => void;
}

export const AlphanumericKeypad: React.FC<AlphanumericKeypadProps> = ({ onInput, onDelete, onEnter, onClose }) => {
    const rows = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '-', '.', ','] // Added comma here as requested
    ];

    return (
        <div className="bg-gray-900 border-t border-gray-700 p-1 grid gap-1 select-none w-full">
            {/* Rows 1-4 */}
            {rows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-1 w-full">
                    {row.map((char) => (
                        <button
                            key={char}
                            onClick={() => onInput(char)}
                            className="h-10 flex-1 min-w-0 bg-gray-700 hover:bg-gray-600 active:bg-blue-600 text-white font-bold rounded text-lg transition-colors shadow-sm"
                        >
                            {char}
                        </button>
                    ))}
                </div>
            ))}

            {/* Row 5: Action Keys */}
            <div className="flex gap-1 w-full mt-1">
                <button
                    onClick={onClose}
                    className="h-10 flex-[2] bg-gray-800 border border-gray-600 hover:bg-gray-700 text-gray-300 rounded font-bold text-xs uppercase flex items-center justify-center gap-1 min-w-0"
                >
                    <X className="w-4 h-4" /> Cancel
                </button>

                <button
                    onClick={() => onInput(' ')}
                    className="h-10 flex-[4] bg-gray-700 hover:bg-gray-600 text-white font-bold rounded text-sm uppercase flex items-center justify-center min-w-0"
                >
                    Space
                </button>

                <button
                    onClick={onDelete}
                    className="h-10 flex-[1.5] bg-gray-800 hover:bg-red-900/50 text-white rounded flex items-center justify-center min-w-0"
                >
                    <Delete className="w-5 h-5" />
                </button>
                <button
                    onClick={onEnter}
                    className="h-10 flex-[1.5] bg-blue-600 hover:bg-blue-500 text-white font-bold rounded flex items-center justify-center shadow-lg min-w-0"
                >
                    <Check className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};
