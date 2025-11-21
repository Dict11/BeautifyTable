import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ParsedData, AIInsight, TableRow } from '../types';
import { 
  Download, 
  Sparkles, 
  ArrowUpDown,
  Printer,
  X,
  Eye,
  Columns,
  Check,
  Bold,
  Italic,
  Palette,
  Eraser,
  Loader2,
  Pencil,
  File,
  Layout,
  List
} from 'lucide-react';
import { analyzeTableData } from '../services/geminiService';

interface EditorViewProps {
  data: ParsedData;
}

type ThemeOption = 'minimal' | 'corporate' | 'classic';
type PaperSize = 'a4' | 'letter' | 'legal';
type Orientation = 'portrait' | 'landscape';

const PAGE_DIMENSIONS: Record<PaperSize, { width: string; height: string; label: string }> = {
  a4: { width: '210mm', height: '297mm', label: 'A4' },
  letter: { width: '216mm', height: '279mm', label: 'Letter' },
  legal: { width: '216mm', height: '356mm', label: 'Legal' },
};

// --- Rich Text Parsing Helpers ---

// 1. Parse Italic: _text_
const parseItalic = (text: string): React.ReactNode[] => {
  const parts = text.split(/(_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={i} className="italic text-inherit">{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

// 2. Parse Bold: *text* -> wraps content, handles nested italics
const parseBold = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      // Recursively parse italics inside bold
      return <strong key={i} className="font-bold text-inherit">{parseItalic(part.slice(1, -1))}</strong>;
    }
    // Parse italics in non-bold text
    return <span key={i}>{parseItalic(part)}</span>;
  });
};

// 3. Parse Color: [color=#hex]...[/color] -> wraps content, handles nested bold/italic
const parseColor = (text: string): React.ReactNode[] => {
  // Regex for non-nested color tags
  const regex = /(\[color=#[0-9a-fA-F]{3,6}\].*?\[\/color\])/g;
  const parts = text.split(regex);
  
  return parts.map((part, i) => {
    const match = part.match(/^\[color=(#[0-9a-fA-F]{3,6})\](.*?)\[\/color\]$/);
    if (match) {
      return (
        <span key={i} style={{ color: match[1] }}>
          {parseBold(match[2])}
        </span>
      );
    }
    return <span key={i}>{parseBold(part)}</span>;
  });
};

// Main Cell Renderer (Memoized for performance)
const FormattedCell = React.memo(({ text }: { text: any }) => {
  const str = String(text);
  if (!str) return null;

  // Split by newlines to handle blocks
  const lines = str.split(/\r?\n/);
  
  // Counter for ordered lists
  let olCount = 0;

  return (
    <div className="flex flex-col gap-0.5 w-full min-w-0 break-words">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        
        // Check for Ordered List (# )
        const isOrderedList = trimmed.match(/^#\s/);

        // Reset counter if not in an ordered list block and line is not empty
        if (!isOrderedList && trimmed !== '') {
          olCount = 0;
        }

        if (!trimmed) return <div key={i} className="h-2" />; // Empty line spacer

        // Headers
        if (trimmed.match(/^h1\s/i)) {
          return (
            <h1 key={i} className="text-lg font-extrabold leading-tight mb-1 mt-2 first:mt-0 text-brand-900 break-words w-full min-w-0">
              {parseColor(trimmed.replace(/^h1\s/i, ''))}
            </h1>
          );
        }
        if (trimmed.match(/^h2\s/i)) {
          return (
            <h2 key={i} className="text-base font-bold leading-tight mb-1 mt-1.5 first:mt-0 text-brand-800 break-words w-full min-w-0">
              {parseColor(trimmed.replace(/^h2\s/i, ''))}
            </h2>
          );
        }
        if (trimmed.match(/^h3\s/i)) {
          return (
            <h3 key={i} className="text-sm font-bold leading-snug mb-0.5 mt-1 first:mt-0 text-brand-700 break-words w-full min-w-0">
              {parseColor(trimmed.replace(/^h3\s/i, ''))}
            </h3>
          );
        }

        // Numbered List (#)
        if (isOrderedList) {
          olCount++;
          return (
            <div key={i} className="flex items-start gap-2 pl-1 my-0.5 w-full min-w-0">
              <span className="text-brand-500 font-bold leading-relaxed shrink-0 mt-0.5 min-w-[1.2em]">{olCount}.</span>
              <span className="leading-relaxed flex-1 min-w-0 break-words">{parseColor(trimmed.replace(/^#\s/, ''))}</span>
            </div>
          );
        }

        // Bullet Lists (+, -, *)
        if (trimmed.match(/^[+\-*]\s/)) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1 my-0.5 w-full min-w-0">
              <span className="text-brand-400 font-bold leading-relaxed shrink-0 mt-0.5">•</span>
              <span className="leading-relaxed flex-1 min-w-0 break-words">{parseColor(trimmed.replace(/^[+\-*]\s/, ''))}</span>
            </div>
          );
        }

        // Regular Paragraph
        return (
          <div key={i} className="leading-relaxed break-words w-full min-w-0">
            {parseColor(line)} 
          </div>
        );
      })}
    </div>
  );
});

export const EditorView: React.FC<EditorViewProps> = ({ data }) => {
  // Data State
  const [tableRows, setTableRows] = useState<TableRow[]>(data.rows);
  
  // Analysis State
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // UI State
  const [activeTheme, setActiveTheme] = useState<ThemeOption>('minimal');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>({});
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  
  // PDF Config State
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [rowsPerPage, setRowsPerPage] = useState<number>(20);

  // Selection State
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set()); // Format: "rowId-colKey"
  const [lastSelected, setLastSelected] = useState<string | null>(null);

  // Refs
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const resizingColRef = useRef<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  useEffect(() => {
    setTableRows(data.rows);
  }, [data]);

  // Handle PDF Loading State
  useEffect(() => {
    if (showPdfPreview) {
      setIsGeneratingPdf(true);
      // Auto-adjust default rows per page based on orientation
      setRowsPerPage(orientation === 'portrait' ? 20 : 12);
      const timer = setTimeout(() => setIsGeneratingPdf(false), 600);
      return () => clearTimeout(timer);
    }
  }, [showPdfPreview, paperSize, orientation]);

  // Click outside to close column menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Handlers ---

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const keys = data.columns.map(c => c.key);
    const result = await analyzeTableData(keys, tableRows);
    setInsight(result);
    setIsAnalyzing(false);
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    const fileName = insight?.suggestedTitle || data.fileName.replace(/\.[^/.]+$/, "") || 'TableGenius Export';
    document.title = fileName;
    
    // Execute print immediately to ensure browser allows it as a user action
    window.print();
    
    // Restore title after a delay to ensure the Print Dialog has picked up the filename
    setTimeout(() => {
      document.title = originalTitle;
    }, 2000);
  };

  const toggleColumn = (key: string) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(key)) {
      newHidden.delete(key);
    } else {
      newHidden.add(key);
    }
    setHiddenColumns(newHidden);
  };

  const handleCellClick = (rowId: string, colKey: string, e: React.MouseEvent) => {
    const cellId = `${rowId}-${colKey}`;
    
    if (e.ctrlKey || e.metaKey) {
      // Multi-select
      const newSelection = new Set(selectedCells);
      if (newSelection.has(cellId)) {
        newSelection.delete(cellId);
      } else {
        newSelection.add(cellId);
      }
      setSelectedCells(newSelection);
    } else if (e.shiftKey && lastSelected) {
      // Simple range select logic could go here, for now just add
      const newSelection = new Set(selectedCells);
      newSelection.add(cellId);
      setSelectedCells(newSelection);
    } else {
      // Single select
      setSelectedCells(new Set([cellId]));
    }
    setLastSelected(cellId);
  };

  // --- Formatting Logic ---

  const applyFormat = (type: 'bold' | 'italic' | 'color', value?: string) => {
    if (selectedCells.size === 0) return;

    const newRows = tableRows.map(row => {
      const newRow = { ...row };
      let modified = false;

      data.columns.forEach(col => {
        const cellId = `${row.id}-${col.key}`;
        if (selectedCells.has(cellId)) {
          const content = String(newRow[col.key] || '');
          
          // Process line by line to preserve headers/lists
          const lines = content.split(/\r?\n/);
          const newLines = lines.map(line => {
            const trimmed = line.trim();
            let prefix = '';
            let text = line;

            // Extract prefixes
            if (trimmed.match(/^h[1-3]\s/i)) {
              prefix = trimmed.substring(0, 3);
              text = trimmed.substring(3);
            } else if (trimmed.match(/^[+\-*]\s/)) {
              prefix = trimmed.substring(0, 2);
              text = trimmed.substring(2);
            } else if (trimmed.match(/^#\s/)) {
              prefix = trimmed.substring(0, 2);
              text = trimmed.substring(2);
            }

            let newText = text;

            if (type === 'bold') {
              // Toggle Bold (*...*)
              if (newText.trim().startsWith('*') && newText.trim().endsWith('*')) {
                newText = newText.replace(/^\*|\*$/g, ''); // Unwrap
              } else {
                newText = `*${newText}*`; // Wrap
              }
            } else if (type === 'italic') {
               // Toggle Italic (_..._)
               if (newText.trim().startsWith('_') && newText.trim().endsWith('_')) {
                 newText = newText.replace(/^_+|_+$/g, '');
               } else {
                 newText = `_${newText}_`;
               }
            } else if (type === 'color' && value) {
               // Apply Color [color=...]...[/color]
               // Remove existing color tags first
               newText = newText.replace(/\[color=#[0-9a-fA-F]{3,6}\](.*?)\[\/color\]/g, '$1');
               newText = `[color=${value}]${newText}[/color]`;
            }

            return prefix + newText;
          });

          newRow[col.key] = newLines.join('\n');
          modified = true;
        }
      });

      return modified ? newRow : row;
    });

    setTableRows(newRows);
  };

  const clearFormatting = () => {
    const newRows = tableRows.map(row => {
      const newRow = { ...row };
      data.columns.forEach(col => {
        if (selectedCells.has(`${row.id}-${col.key}`)) {
          let text = String(newRow[col.key] || '');
          // Remove all markers
          text = text.replace(/\[color=.*?\](.*?)\[\/color\]/g, '$1');
          text = text.replace(/\*(.*?)\*/g, '$1');
          text = text.replace(/_(.*?)_/g, '$1');
          newRow[col.key] = text;
        }
      });
      return newRow;
    });
    setTableRows(newRows);
  };

  // --- Resize Logic ---
  const startResize = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColRef.current = colKey;
    startXRef.current = e.pageX;
    startWidthRef.current = columnWidths[colKey] || 200;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (resizingColRef.current) {
      const diff = e.pageX - startXRef.current;
      const newWidth = Math.max(80, startWidthRef.current + diff);
      setColumnWidths(prev => ({ ...prev, [resizingColRef.current!]: newWidth }));
    }
  };

  const handleMouseUp = () => {
    resizingColRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'default';
  };

  const getCellBadgeStyle = (value: string) => {
    const colors = [
      'bg-blue-50 text-blue-700 border-blue-100',
      'bg-green-50 text-green-700 border-green-100',
      'bg-purple-50 text-purple-700 border-purple-100',
      'bg-orange-50 text-orange-700 border-orange-100',
      'bg-pink-50 text-pink-700 border-pink-100',
    ];
    const index = value.length % colors.length;
    return colors[index];
  };

  // Filter Visible Columns
  const visibleColumns = useMemo(() => {
    return data.columns.filter(col => !hiddenColumns.has(col.key));
  }, [data.columns, hiddenColumns]);

  // Pagination Logic for Preview
  const paginatedRows = useMemo(() => {
    const pages = [];
    for (let i = 0; i < tableRows.length; i += rowsPerPage) {
      pages.push(tableRows.slice(i, i + rowsPerPage));
    }
    return pages;
  }, [tableRows, rowsPerPage]);

  // Theme Classes
  const getThemeClasses = () => {
    const commonTd = 'p-4 text-sm text-brand-800 align-top whitespace-normal break-words transition-colors';
    switch (activeTheme) {
      case 'corporate':
        return {
          table: 'border-collapse w-full',
          thead: 'bg-brand-900 text-white',
          th: 'p-4 text-xs font-bold uppercase tracking-wider border-r border-brand-800 last:border-r-0',
          tbody: 'divide-y divide-brand-200',
          tr: 'even:bg-brand-50 hover:bg-brand-100 break-inside-avoid',
          td: `${commonTd} border-r border-brand-200 last:border-r-0`,
        };
      case 'classic':
        return {
          table: 'border-collapse w-full',
          thead: 'bg-brand-100 border-b-2 border-brand-300',
          th: 'p-3 text-sm font-bold text-brand-900 text-left border-r border-brand-200 last:border-r-0',
          tbody: 'divide-y divide-brand-200',
          tr: 'hover:bg-blue-50 break-inside-avoid',
          td: `${commonTd} border-r border-brand-200 last:border-r-0`,
        };
      case 'minimal':
      default:
        return {
          table: 'w-full',
          thead: 'border-b border-brand-200',
          th: 'p-5 text-xs font-bold text-brand-400 uppercase tracking-widest text-left',
          tbody: 'divide-y divide-brand-100',
          tr: 'hover:bg-brand-50 break-inside-avoid',
          td: `${commonTd} text-brand-600`,
        };
    }
  };

  const theme = getThemeClasses();

  // Preview Dimensions Helper
  const getPreviewDimensions = () => {
    const dim = PAGE_DIMENSIONS[paperSize];
    if (orientation === 'landscape') {
      return { width: dim.height, height: dim.width }; // Use fixed height for pages
    }
    return { width: dim.width, height: dim.height };
  };
  const previewDims = getPreviewDimensions();

  return (
    <div className="flex flex-col h-full bg-brand-50">
      <style>
        {`
          @media print {
            @page { 
              size: ${paperSize} ${orientation}; 
              margin: 0mm; 
            }
            html, body {
              height: 100% !important;
              overflow: visible !important;
              background: white !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              display: block !important;
            }
            
            /* Hide everything by default */
            body * { visibility: hidden; }
            
            /* Show print content */
            .print-container, .print-container * { 
              visibility: visible; 
            }
            
            .print-container { 
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important; 
              background: white !important; 
              z-index: 9999;
            }

            .print-page {
              page-break-after: always;
              break-after: page;
              height: 100% !important; /* Force full height check */
              width: 100% !important;
              margin: 0 !important;
              box-shadow: none !important;
              position: relative !important;
              overflow: hidden !important; /* Ensure content stays in page */
            }

            .print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            
            /* Explicitly hide elements marked no-print */
            .no-print { display: none !important; }

            thead { display: table-header-group; }
            
            /* Table Scaling logic */
            table {
              width: 100% !important;
              table-layout: fixed !important;
              font-size: 9pt !important;
            }
            
            th, td {
              white-space: normal !important;
              overflow-wrap: anywhere !important;
              word-break: break-word !important;
              padding: 4px 6px !important;
            }
            
            ::-webkit-scrollbar { display: none; }
          }
        `}
      </style>

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-[100] bg-brand-900/80 backdrop-blur-sm flex items-center justify-center p-8 animate-fade-in print:inset-auto print:static print:block print:h-auto print:w-auto print:bg-transparent print:p-0">
          <div className="bg-brand-100 w-full h-full max-w-6xl rounded-2xl flex flex-col overflow-hidden shadow-2xl relative print:bg-transparent print:shadow-none print:rounded-none print:h-auto print:w-auto print:max-w-none print:overflow-visible">
            
            {/* Loading Overlay - No Print */}
            {isGeneratingPdf && (
              <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in no-print">
                 <Loader2 size={48} className="text-brand-900 animate-spin mb-4" />
                 <h3 className="text-xl font-bold text-brand-900">Preparing Layout...</h3>
                 <p className="text-brand-500 text-sm mt-1">Pagination: {rowsPerPage} rows / page</p>
              </div>
            )}

            {/* Header / Toolbar - No Print */}
            <div className="bg-white border-b border-brand-200 p-4 flex flex-wrap gap-4 justify-between items-center shadow-sm z-10 no-print">
              <div className="flex items-center gap-3">
                 <div className="bg-brand-100 p-2 rounded-lg text-brand-700">
                    <Printer size={20} />
                 </div>
                 <div>
                    <h3 className="font-bold text-brand-900">Print Preview</h3>
                    <p className="text-xs text-brand-500">Page Setup</p>
                 </div>
              </div>

              {/* PDF Config Controls */}
              <div className="flex items-center gap-4 bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-200">
                  <div className="flex items-center gap-2">
                     <File size={14} className="text-brand-400" />
                     <select 
                      value={paperSize} 
                      onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                      className="bg-transparent text-sm font-semibold text-brand-700 focus:outline-none cursor-pointer"
                     >
                        <option value="a4">A4 (210 x 297 mm)</option>
                        <option value="letter">Letter (8.5" x 11")</option>
                        <option value="legal">Legal (8.5" x 14")</option>
                     </select>
                  </div>
                  <div className="w-px h-4 bg-brand-300"></div>
                  <div className="flex items-center gap-2">
                     <Layout size={14} className="text-brand-400" />
                     <select 
                      value={orientation} 
                      onChange={(e) => setOrientation(e.target.value as Orientation)}
                      className="bg-transparent text-sm font-semibold text-brand-700 focus:outline-none cursor-pointer"
                     >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                     </select>
                  </div>
                  <div className="w-px h-4 bg-brand-300"></div>
                  <div className="flex items-center gap-2" title="Adjust rows per page to fit content">
                     <List size={14} className="text-brand-400" />
                     <span className="text-xs font-semibold text-brand-400 whitespace-nowrap">Rows:</span>
                     <input 
                       type="number" 
                       min="5" 
                       max="100" 
                       value={rowsPerPage} 
                       onChange={(e) => setRowsPerPage(Number(e.target.value))}
                       className="w-12 bg-transparent text-sm font-semibold text-brand-700 focus:outline-none text-center border-b border-brand-300 focus:border-brand-600"
                     />
                  </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowPdfPreview(false)} className="px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={handlePrint} 
                  className="px-4 py-2 text-sm font-medium bg-brand-900 text-white hover:bg-brand-800 rounded-lg flex items-center gap-2 transition-colors shadow-sm active:scale-95 cursor-pointer"
                >
                  <Download size={16} /> Download PDF
                </button>
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-auto p-8 flex flex-col items-center bg-brand-200/50 custom-scrollbar print:overflow-visible print:h-auto print:block print:p-0 print:bg-white">
              
              <div className="print-container">
                {paginatedRows.map((pageRows, pageIndex) => (
                  <div 
                    key={pageIndex}
                    className="bg-white shadow-xl print-page transition-all duration-300 ease-in-out mb-8 last:mb-0 overflow-hidden"
                    style={{ 
                      width: previewDims.width,
                      height: previewDims.height, // Fixed height for simulation
                      padding: '15mm',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {/* Page Header: Only on First Page */}
                    {pageIndex === 0 && (
                      <div className="mb-6 border-b-2 border-brand-900 pb-4 shrink-0">
                        <div className="flex justify-between items-end mb-4">
                           <h1 className="text-3xl font-bold text-brand-900 leading-tight truncate pr-4">{insight?.suggestedTitle || data.fileName}</h1>
                           <span className="text-xs font-bold text-brand-300 uppercase tracking-widest mb-1 shrink-0">TableGenius Export</span>
                        </div>
                        <p className="text-brand-500 text-sm leading-relaxed max-w-prose line-clamp-3">
                          {insight?.summary || `Data export generated on ${new Date().toLocaleDateString()}.`}
                        </p>
                      </div>
                    )}

                    {/* Table Content - Flex Grow to fill space */}
                    <div className="flex-1 overflow-hidden w-full">
                      <table className={`${theme.table} text-left w-full`}>
                        <thead className={`${theme.thead}`}>
                          <tr>{visibleColumns.map(col => <th key={col.key} className={theme.th}>{col.label}</th>)}</tr>
                        </thead>
                        <tbody className={theme.tbody}>
                          {pageRows.map(row => (
                            <tr key={row.id} className={theme.tr}>
                              {visibleColumns.map(col => (
                                <td 
                                  key={`${row.id}-${col.key}`} 
                                  className={theme.td}
                                >
                                  {col.type === 'tag' ? (
                                    <span className={`px-2 py-1 rounded border text-xs font-semibold whitespace-nowrap ${getCellBadgeStyle(row[col.key])}`}>{row[col.key]}</span>
                                  ) : col.type === 'currency' ? (
                                    <span className="font-mono text-brand-900">{row[col.key]}</span>
                                  ) : (
                                    <FormattedCell text={row[col.key]} />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Page Footer */}
                    <div className="mt-auto pt-4 border-t border-brand-100 flex justify-between text-xs text-brand-300 shrink-0">
                       <span>Generated by TableGenius</span>
                       <span>Page {pageIndex + 1} of {paginatedRows.length}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Main Toolbar */}
      <div className="bg-white border-b border-brand-200 pl-20 pr-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-6 z-20 no-print shadow-sm">
        <div className="flex flex-col gap-2">
           <div>
              <h2 className="text-lg font-bold text-brand-900 leading-none mb-1">{insight?.suggestedTitle || data.fileName}</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium bg-brand-100 text-brand-600 px-2 py-0.5 rounded">{tableRows.length} Rows</span>
              </div>
           </div>
           
           {/* Formatting Toolbar */}
           <div className="flex items-center gap-1 bg-brand-50 p-1 rounded-lg border border-brand-200 w-fit">
              <button 
                onClick={() => applyFormat('bold')} 
                className="p-1.5 text-brand-600 hover:bg-white hover:text-brand-900 rounded-md transition-all"
                title="Bold"
              >
                <Bold size={16} strokeWidth={2.5} />
              </button>
              <button 
                onClick={() => applyFormat('italic')} 
                className="p-1.5 text-brand-600 hover:bg-white hover:text-brand-900 rounded-md transition-all"
                title="Italic"
              >
                <Italic size={16} />
              </button>
              <div className="h-4 w-px bg-brand-200 mx-0.5"></div>
              <div className="relative group">
                 <button className="p-1.5 text-brand-600 hover:bg-white hover:text-brand-900 rounded-md transition-all flex items-center gap-1">
                    <Palette size={16} />
                 </button>
                 <div className="absolute top-full left-0 mt-2 bg-white border border-brand-200 shadow-lg rounded-lg p-2 grid grid-cols-4 gap-1 w-32 hidden group-hover:grid z-50">
                    {['#000000', '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6'].map(color => (
                       <button 
                         key={color} 
                         onClick={() => applyFormat('color', color)}
                         className="w-6 h-6 rounded-full border border-gray-100 hover:scale-110 transition-transform"
                         style={{ backgroundColor: color }}
                       />
                    ))}
                 </div>
              </div>
              <div className="h-4 w-px bg-brand-200 mx-0.5"></div>
              <button 
                onClick={clearFormatting}
                className="p-1.5 text-brand-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                title="Clear Formatting"
              >
                <Eraser size={16} />
              </button>
           </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative" ref={columnMenuRef}>
            <button 
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm border transition-all ${showColumnMenu ? 'bg-brand-50 border-brand-300 text-brand-900' : 'bg-white border-brand-200 text-brand-600 hover:bg-brand-50'}`}
            >
              <Columns size={16} /> Columns
            </button>
            {showColumnMenu && (
              <div className="absolute top-full mt-2 right-0 w-56 bg-white rounded-xl shadow-xl border border-brand-100 z-30 overflow-hidden animate-fade-in-up">
                <div className="px-4 py-3 bg-brand-50 border-b border-brand-100"><span className="text-xs font-bold text-brand-500 uppercase tracking-wider">Show/Hide Columns</span></div>
                <div className="max-h-60 overflow-y-auto p-2">
                  {data.columns.map(col => (
                    <label key={col.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-brand-50 cursor-pointer">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${hiddenColumns.has(col.key) ? 'border-brand-300 bg-white' : 'border-brand-900 bg-brand-900 text-white'}`}>
                        {!hiddenColumns.has(col.key) && <Check size={12} strokeWidth={3} />}
                      </div>
                      <input type="checkbox" className="hidden" checked={!hiddenColumns.has(col.key)} onChange={() => toggleColumn(col.key)} />
                      <span className="text-sm truncate text-brand-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex bg-brand-50 p-1 rounded-lg border border-brand-200">
             {(['minimal', 'corporate', 'classic'] as ThemeOption[]).map(t => (
               <button key={t} onClick={() => setActiveTheme(t)} className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${activeTheme === t ? 'bg-white text-brand-900 shadow-sm' : 'text-brand-500 hover:text-brand-800'}`}>{t}</button>
             ))}
          </div>
          <button onClick={handleAnalyze} disabled={isAnalyzing || !!insight} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm border transition-all ${insight ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-brand-200 text-brand-700 hover:bg-brand-50'}`}>
            <Sparkles size={16} className={isAnalyzing ? 'animate-spin' : ''} /> {isAnalyzing ? 'Analyzing...' : insight ? 'AI Insights' : 'Analyze'}
          </button>
          <button onClick={() => setShowPdfPreview(true)} className="flex items-center gap-2 px-4 py-2 bg-brand-900 text-white rounded-lg hover:bg-brand-800 font-medium text-sm shadow-sm transition-all active:scale-95">
            <Eye size={16} /> Preview & Export
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-hidden flex flex-col p-8 no-print">
        {insight && (
          <div className="mb-6 bg-white border border-purple-100 p-5 rounded-xl relative overflow-hidden shadow-sm">
             <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
             <div className="flex gap-3">
                <div className="bg-purple-100 p-2 rounded-lg h-fit text-purple-600"><Sparkles size={18} /></div>
                <div><h4 className="text-sm font-bold text-purple-900 mb-1">AI Summary</h4><p className="text-brand-600 text-sm leading-relaxed">{insight.summary}</p></div>
             </div>
          </div>
        )}

        <div className="flex-1 bg-white border border-brand-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
          <div className="flex-1 overflow-auto relative custom-scrollbar">
            <table className={`${theme.table} table-fixed`}>
              <thead className={`${theme.thead} sticky top-0 z-10 shadow-sm`}>
                <tr>
                  {visibleColumns.map(col => (
                    <th key={col.key} className={`${theme.th} relative group select-none`} style={{ width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : 'auto', minWidth: '150px' }}>
                      <div className="flex items-center justify-between gap-2 pr-3"><span className="truncate">{col.label}</span><ArrowUpDown size={12} className="text-brand-300 opacity-0 group-hover:opacity-100" /></div>
                      <div className="absolute right-0 top-0 bottom-0 w-5 cursor-col-resize z-20 flex justify-center group/resizer" onMouseDown={(e) => startResize(e, col.key)}>
                        <div className="w-px h-full bg-brand-200 group-hover/resizer:bg-brand-500 transition-colors delay-75"></div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={theme.tbody}>
                {tableRows.map(row => (
                  <tr key={row.id} className={theme.tr}>
                    {visibleColumns.map(col => {
                      const cellId = `${row.id}-${col.key}`;
                      const isSelected = selectedCells.has(cellId);
                      return (
                        <td 
                          key={cellId} 
                          onClick={(e) => handleCellClick(row.id, col.key, e)}
                          className={`${theme.td} ${isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-400 z-10' : ''} cursor-cell`}
                        >
                          {col.type === 'tag' ? (
                             <span className={`px-2 py-1 rounded border text-xs font-semibold whitespace-nowrap ${getCellBadgeStyle(row[col.key])}`}>{row[col.key]}</span>
                          ) : col.type === 'currency' ? (
                             <span className="font-mono text-brand-900">{row[col.key]}</span>
                          ) : (
                             <FormattedCell text={row[col.key]} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};