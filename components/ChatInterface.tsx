
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, FileText, Sparkles, RefreshCcw } from 'lucide-react';
import { ChatMessage, CsvFile } from '../types';
import { geminiService } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  files: CsvFile[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ files }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      content: `**Welcome to IMS Gemini.** \n\nI am ready to help you analyze your inventory and sales data. \n\nPlease go to the **Data Sources** tab to upload your CSV files. Once loaded, I can assist with specific queries.`,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    if (files.length === 0) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: '⚠️ Please upload CSV files in the Data Sources tab first so I can analyze them.',
        timestamp: Date.now()
      }]);
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Format history for the API
      const history = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }));

      const responseText = await geminiService.sendMessage(userMsg.content, history, files);
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText || "I couldn't generate a response.",
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: 'Error communicating with Gemini. Please check your API Key configuration.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-dark-surface rounded-2xl border border-dark-border overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-dark-border bg-dark-surface flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gemini-400" />
          <h3 className="font-semibold text-gray-200">IMS Assistant</h3>
        </div>
        <div className="text-xs text-gray-500 bg-dark-bg px-2 py-1 rounded">
          Using Gemini 2.5 Flash
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' ? 'bg-gray-600' : msg.role === 'system' ? 'bg-red-900/50' : 'bg-gemini-600'
            }`}>
              {msg.role === 'user' ? <FileText className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
            </div>
            
            <div className={`max-w-[90%] rounded-2xl px-5 py-3.5 ${
              msg.role === 'user' 
                ? 'bg-gray-700 text-white rounded-tr-none' 
                : msg.role === 'system'
                ? 'bg-red-950/30 border border-red-900/50 text-red-200'
                : 'bg-dark-bg border border-dark-border text-gray-200 rounded-tl-none shadow-sm'
            }`}>
              {/* Added whitespace-pre-wrap to enforce newlines from plain text response */}
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded-full bg-gemini-600 flex items-center justify-center flex-shrink-0">
               <RefreshCcw className="w-5 h-5 text-white animate-spin" />
             </div>
             <div className="bg-dark-bg border border-dark-border text-gray-400 rounded-2xl rounded-tl-none px-5 py-3.5">
               Thinking...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-dark-bg border-t border-dark-border">
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={files.length > 0 ? "Ask questions about your data..." : "Upload data first to start chatting"}
            disabled={isLoading}
            className="w-full bg-dark-surface border border-dark-border rounded-xl pl-4 pr-12 py-3.5 text-gray-200 focus:outline-none focus:border-gemini-500 focus:ring-1 focus:ring-gemini-500/50 transition-all placeholder-gray-600"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 bg-gemini-600 hover:bg-gemini-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 text-center text-xs text-gray-600">
          AI can make mistakes. Please verify generated insights.
        </div>
      </div>
    </div>
  );
};
