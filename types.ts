export enum AppState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  PREVIEW = 'PREVIEW',
  EDITOR = 'EDITOR',
  ERROR = 'ERROR'
}

export interface TableRow {
  id: string;
  [key: string]: any;
}

export interface TableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'tag';
}

export interface ParsedData {
  fileName: string;
  fileSize: number;
  columns: TableColumn[];
  rows: TableRow[];
  uploadDate: string;
}

export interface HistoryItem {
  id: string;
  fileName: string;
  date: string;
  rowCount: number;
}

export interface AIInsight {
  summary: string;
  suggestedTitle: string;
}