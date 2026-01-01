import React from 'react';

interface HeightCalculatorProps {
    visualTotalHeight: number; // e.g., 192 (180 + 12)
    liftHeight: number; // e.g., 12
    productHeight: number; // e.g., 180
    containerHeight: number; // e.g., 30
    modelHeight?: number; // e.g., 175
    messages: string[];
    showVisual?: boolean;
}

export const HeightCalculator: React.FC<HeightCalculatorProps> = ({
    visualTotalHeight,
    liftHeight,
    productHeight,
    containerHeight,
    modelHeight,
    messages,
    showVisual = true
}) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow max-w-lg mx-auto border-t-4 border-blue-500">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Height Validation Logic</h2>

            {showVisual && (
                <div className="flex items-end justify-center space-x-8 mb-6 h-64 border-b pb-2">
                    {/* Model Bar */}
                    {modelHeight && (
                        <div className="flex flex-col items-center">
                            <span className="mb-1 text-sm font-bold text-gray-500">{modelHeight}cm</span>
                            <div
                                style={{ height: `${modelHeight}px` }} // 1px = 1cm for simple scaling demo
                                className="w-12 bg-pink-300 rounded-t shadow-sm"
                                title="Model"
                            ></div>
                            <span className="mt-2 text-xs text-gray-500">Model</span>
                        </div>
                    )}

                    {/* Product Stack */}
                    <div className="flex flex-col items-center relative">
                        <span className="mb-1 text-sm font-bold text-blue-600">Total: {visualTotalHeight}cm</span>

                        <div className="flex flex-col-reverse w-16 shadow-sm">
                            {/* Container Part that contributes to height? No, technically the lift is inside. 
                 But visibly, the plant sits ON TOP of the lift inside the pot.
                 Wait, spec says: "Visual Total = Plant Height + Left". 
                 The pot itself is at the bottom. The plant starts at (ContainerHeight - PotHeight) if Lift > 0.
                 Actually, simpler visualization: Stack Plan on top of Lift.
             */}

                            {/* The Container (Visual Base) */}
                            <div
                                style={{ height: `${containerHeight}px` }}
                                className="bg-gray-800 w-full rounded-b relative"
                                title={`Container: ${containerHeight}cm`}
                            >
                                {/* The Lift (Invisible filler) */}
                                <div
                                    style={{ height: `${liftHeight}px` }}
                                    className="bg-gray-600 w-full absolute bottom-0 opacity-50 border-t border-dashed border-white"
                                    title={`Lift: ${liftHeight}cm`}
                                ></div>
                            </div>

                            {/* The Plant */}
                            <div
                                style={{ height: `${productHeight}px` }}
                                className="bg-green-500 w-10 mx-auto rounded-t relative -mb-0"
                                // Note: This visualization is simplified. In reality partial overlap checks needed.
                                // But we just stack them for "Effective Height" visual.
                                title={`Plant: ${productHeight}cm`}
                            ></div>
                        </div>
                        <span className="mt-2 text-xs text-gray-500">Decorated</span>
                    </div>
                </div>
            )}

            <div className="space-y-2 bg-blue-50 p-4 rounded text-sm text-blue-800">
                {messages.map((msg, i) => (
                    <p key={i}>• {msg}</p>
                ))}
            </div>
        </div>
    );
};
