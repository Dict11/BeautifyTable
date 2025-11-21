import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { UploadZone } from './components/UploadZone';
import { ProcessingView } from './components/ProcessingView';
import { EditorView } from './components/EditorView';
import { AppState, ParsedData, HistoryItem } from './types';
import { parseCSV, parseHTML } from './utils/parser';
import { parseDocumentWithAI } from './services/geminiService';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('tableGeniusHistory');
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  const saveToHistory = (data: ParsedData) => {
    const newItem: HistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      fileName: data.fileName,
      date: new Date().toLocaleDateString(),
      rowCount: data.rows.length
    };
    const newHistory = [newItem, ...history];
    setHistory(newHistory);
    localStorage.setItem('tableGeniusHistory', JSON.stringify(newHistory));
  };

  const handleDeleteHistory = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('tableGeniusHistory', JSON.stringify(newHistory));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:mime/type;base64, prefix to get raw base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileSelect = async (file: File) => {
    setCurrentFile(file);
    setError(undefined);
    setState(AppState.UPLOADING);

    const isAIFormat = file.type === 'application/pdf' || 
                       file.name.toLowerCase().endsWith('.pdf');

    try {
      if (isAIFormat) {
        setState(AppState.PROCESSING);
        // Process with AI
        const base64 = await fileToBase64(file);
        // Determine mime type strictly for API
        let mimeType = file.type;
        if (!mimeType || mimeType === '') {
            if (file.name.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
        }
        
        // Verify mimeType is supported by our logic (double check)
        if (mimeType !== 'application/pdf') {
           throw new Error("Unsupported file type for AI processing. Only PDF is supported.");
        }

        const result = await parseDocumentWithAI(base64, mimeType);
        
        const newData: ParsedData = {
          fileName: file.name,
          fileSize: file.size,
          columns: result.columns,
          rows: result.rows,
          uploadDate: new Date().toISOString()
        };
        setParsedData(newData);

      } else {
        // Process locally (CSV/HTML)
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const content = e.target?.result as string;
            setState(AppState.PROCESSING);
            
            // Simulate "Processing" delay for UX consistency
            await new Promise(resolve => setTimeout(resolve, 800));

            let result;
            if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
              result = parseCSV(content);
            } else if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm') || file.type === 'text/html') {
              result = parseHTML(content);
            } else {
               throw new Error("Unsupported file format");
            }

            const newData: ParsedData = {
              fileName: file.name,
              fileSize: file.size,
              columns: result.columns,
              rows: result.rows,
              uploadDate: new Date().toISOString()
            };
            setParsedData(newData);
          } catch (err) {
            console.error(err);
            setError("Could not parse file locally. Please ensure it is a valid CSV or HTML file.");
            setState(AppState.IDLE);
          }
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      console.error(err);
      // Safely extract error message
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Conversion failed: ${msg}`);
      setState(AppState.IDLE);
    }
  };

  const handleProcessingComplete = () => {
    if (parsedData) {
      saveToHistory(parsedData);
      setState(AppState.EDITOR);
    }
  };

  const handleNewUpload = () => {
    setState(AppState.IDLE);
    setParsedData(null);
    setCurrentFile(null);
    setError(undefined);
    setIsSidebarOpen(false);
  };

  return (
    <div className="relative h-screen w-screen bg-brand-50 font-sans overflow-hidden flex">
      
      <Sidebar 
        history={history} 
        onNewUpload={handleNewUpload}
        onSelectHistory={() => {}} 
        onDeleteHistory={handleDeleteHistory}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Menu Toggle Button */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="fixed top-5 left-5 z-30 p-2.5 bg-white rounded-xl shadow-sm border border-brand-200 text-brand-600 hover:bg-brand-50 hover:text-brand-900 transition-all no-print group active:scale-95"
        aria-label="Open Menu"
      >
        <Menu size={20} className="group-hover:scale-110 transition-transform" />
      </button>
      
      <main className="flex-1 flex flex-col h-full w-full overflow-hidden relative bg-brand-50 transition-all duration-300">
        {state === AppState.IDLE || state === AppState.UPLOADING ? (
          <div className="flex-1 flex items-center justify-center p-8">
             <UploadZone onFileSelect={handleFileSelect} error={error} />
          </div>
        ) : state === AppState.PROCESSING ? (
          <div className="flex-1 flex items-center justify-center p-8">
             <ProcessingView 
               fileName={currentFile?.name || "File"} 
               onComplete={handleProcessingComplete} 
             />
          </div>
        ) : state === AppState.EDITOR && parsedData ? (
          <EditorView data={parsedData} />
        ) : null}
      </main>
    </div>
  );
};

export default App;