
import React, { useCallback } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, Trash2, Save } from 'lucide-react';
import { CsvFile } from '../types';
import { saveFileToDB, deleteFileFromDB } from '../services/db';

interface CsvUploaderProps {
  files: CsvFile[];
  setFiles: React.Dispatch<React.SetStateAction<CsvFile[]>>;
}

export const CsvUploader: React.FC<CsvUploaderProps> = ({ files, setFiles }) => {
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    Array.from(uploadedFiles).forEach((file: File) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const newFile: CsvFile = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            rowCount: results.data.length,
            headers: results.meta.fields || [],
            data: results.data,
            preview: results.data.slice(0, 5)
          };
          
          // Save to DB first, then update state
          try {
            await saveFileToDB(newFile);
            setFiles(prev => [...prev, newFile]);
          } catch (error) {
            console.error("Failed to persist file", error);
            alert("Warning: Failed to save file to local storage, it will be lost on refresh.");
            setFiles(prev => [...prev, newFile]);
          }
        },
        error: (error: any) => {
          console.error("Error parsing CSV:", error);
          alert(`Failed to parse ${file.name}`);
        }
      });
    });
    
    // Reset input
    event.target.value = '';
  };

  const removeFile = async (id: string) => {
    try {
      await deleteFileFromDB(id);
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch (error) {
      console.error("Failed to delete from DB", error);
      // Still remove from UI
      setFiles(prev => prev.filter(f => f.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-8 rounded-2xl border-dashed border-2 border-gray-700 flex flex-col items-center justify-center text-center hover:border-gemini-500 transition-colors duration-300">
        <div className="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center mb-4 shadow-inner">
          <Upload className="w-8 h-8 text-gemini-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Upload CSV Data</h3>
        <p className="text-gray-400 mb-6 max-w-md">
          Select your raw data files (CSV). The system will automatically analyze the schema and save it to your local database.
        </p>
        <label className="relative cursor-pointer">
          <input 
            type="file" 
            multiple 
            accept=".csv" 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <span className="bg-gemini-600 hover:bg-gemini-500 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-gemini-600/30">
            Select Files
          </span>
        </label>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <DatabaseIcon /> Stored Datasets ({files.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map(file => (
              <div key={file.id} className="glass-panel p-5 rounded-xl border border-dark-border hover:border-gemini-500/50 transition-all group relative">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-200 truncate max-w-[150px]" title={file.name}>{file.name}</h4>
                      <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB • {file.rowCount} rows</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div title="Saved locally" className="text-green-500 opacity-50 group-hover:opacity-100 transition-opacity">
                      <Save className="w-3 h-3" />
                    </div>
                    <button 
                      onClick={() => removeFile(file.id)}
                      className="text-gray-500 hover:text-red-400 p-1 hover:bg-dark-bg rounded transition-colors"
                      title="Delete from database"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="bg-dark-bg rounded-md p-3 mt-3">
                  <p className="text-xs text-gray-400 mb-2 font-mono flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Schema
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {file.headers.slice(0, 5).map(h => (
                      <span key={h} className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                        {h}
                      </span>
                    ))}
                    {file.headers.length > 5 && (
                      <span className="text-[10px] text-gray-500">+{file.headers.length - 5} more</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DatabaseIcon = () => (
  <svg className="w-5 h-5 text-gemini-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s 9-1.34 9-3V5" />
  </svg>
);
