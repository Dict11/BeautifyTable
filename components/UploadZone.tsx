import React, { useCallback, useState } from 'react';
import { UploadCloud, FileType, AlertCircle, FileText } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  error?: string;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, error }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndUpload(files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const validateAndUpload = (file: File) => {
    // Removed .doc and .docx support as Gemini API does not support application/msword
    const validExtensions = ['.csv', '.html', '.htm', '.pdf'];
    const validTypes = [
      'text/csv', 'text/html', 'text/plain', 'application/vnd.ms-excel',
      'application/pdf'
    ];
    
    const isExtensionValid = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    const isTypeValid = validTypes.includes(file.type) || !file.type; // Allow empty type if extension matches

    if (isExtensionValid || isTypeValid) {
      onFileSelect(file);
    } else {
      alert("Invalid file format. Please upload CSV, HTML, or PDF.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full animate-fade-in">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-brand-900 mb-4">Beautify your Data</h1>
        <p className="text-brand-500 text-lg max-w-lg mx-auto">
          Convert messy HTML, CSV, or PDF files into customizable, professional tables instantly.
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-16 transition-all duration-200 ease-in-out
          flex flex-col items-center justify-center text-center bg-white
          ${isDragging 
            ? 'border-brand-600 bg-brand-50 scale-[1.01]' 
            : 'border-brand-200 hover:border-brand-400 hover:bg-brand-50/30'
          }
          ${error ? 'border-red-300 bg-red-50' : ''}
        `}
      >
        <input
          type="file"
          id="fileInput"
          className="hidden"
          accept=".csv,.html,.htm,.pdf"
          onChange={handleFileInput}
        />

        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-8 transition-colors ${error ? 'bg-red-100 text-red-500' : 'bg-brand-100 text-brand-900'}`}>
          {error ? <AlertCircle size={32} /> : <UploadCloud size={32} />}
        </div>

        {error ? (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-red-600 mb-1">Upload Failed</h3>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-semibold text-brand-900 mb-2">
              {isDragging ? 'Drop file here' : 'Click to upload or drag & drop'}
            </h3>
            <p className="text-brand-400 mb-8">
              Supports .CSV, .HTML, .PDF (Max 10MB)
            </p>
          </>
        )}

        <label
          htmlFor="fileInput"
          className="cursor-pointer bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-900 font-semibold py-3 px-8 rounded-lg transition-all"
        >
          {error ? 'Try Again' : 'Select File'}
        </label>

        <div className="mt-12 flex flex-wrap justify-center gap-8 opacity-40">
           <div className="flex items-center gap-2 text-brand-900 text-xs font-bold uppercase tracking-widest">
              <FileType size={16} />
              <span>CSV</span>
           </div>
           <div className="flex items-center gap-2 text-brand-900 text-xs font-bold uppercase tracking-widest">
              <FileType size={16} />
              <span>HTML</span>
           </div>
           <div className="flex items-center gap-2 text-brand-900 text-xs font-bold uppercase tracking-widest">
              <FileText size={16} />
              <span>PDF</span>
           </div>
        </div>
      </div>
    </div>
  );
};