import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastProps {
    toast: ToastMessage;
    onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(toast.id);
        }, toast.duration || 3000);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onClose]);

    const getToastStyle = () => {
        switch (toast.type) {
            case 'success':
                return 'bg-green-900/90 border-green-500 text-green-100';
            case 'error':
                return 'bg-red-900/90 border-red-500 text-red-100';
            case 'warning':
                return 'bg-yellow-900/90 border-yellow-500 text-yellow-100';
            case 'info':
                return 'bg-blue-900/90 border-blue-500 text-blue-100';
            default:
                return 'bg-gray-900/90 border-gray-500 text-gray-100';
        }
    };

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />;
            case 'info':
                return <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />;
            default:
                return null;
        }
    };

    return (
        <div
            className={`
        ${getToastStyle()}
        min-w-[300px] max-w-md
        border-l-4 rounded-lg shadow-2xl
        p-4 mb-3
        flex items-start gap-3
        animate-slide-in-right
        backdrop-blur-sm
      `}
        >
            {getIcon()}
            <p className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</p>
            <button
                onClick={() => onClose(toast.id)}
                className="text-current opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
                aria-label="Close"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export default Toast;
