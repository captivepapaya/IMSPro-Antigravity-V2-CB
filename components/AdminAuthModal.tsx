
import React, { useState } from 'react';
import { Lock, Unlock, X } from 'lucide-react';

interface AdminAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title?: string;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose, onSuccess, title = "Admin Verification" }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'imsgimini') {
            onSuccess();
            onClose();
            setPassword('');
            setError(false);
        } else {
            setError(true);
            setTimeout(() => setError(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-dark-surface border border-dark-border rounded-2xl p-8 max-w-sm w-full shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gemini-600/20 rounded-full flex items-center justify-center text-gemini-400">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-white text-center">{title}</h2>
                    <p className="text-sm text-gray-400 text-center">
                        Authorized personnel only.<br />Please enter access code.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full bg-dark-bg border ${error ? 'border-red-500 animate-shake' : 'border-dark-border'} focus:border-gemini-500 rounded-lg px-4 py-3 text-center text-white tracking-widest text-lg outline-none transition-colors`}
                        placeholder="••••••••"
                        autoFocus
                    />

                    {error && <p className="text-red-500 text-xs text-center font-bold">Access Denied</p>}

                    <button
                        type="submit"
                        className="w-full py-3 bg-gemini-600 hover:bg-gemini-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Unlock className="w-4 h-4" /> Verify Access
                    </button>
                </form>
            </div>
        </div>
    );
};
