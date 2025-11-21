import { TableRow, TableColumn } from '../types';

// Simple UUID generator
export const generateId = () => Math.random().toString(36).substr(2, 9);

// Detect column type based on content
export const detectType = (values: any[]): TableColumn['type'] => {
  const validValues = values.filter(v => v !== null && v !== undefined && v !== '');
  if (validValues.length === 0) return 'text';

  const isNumber = validValues.every(v => !isNaN(Number(v.replace(/[$,]/g, ''))));
  if (isNumber) {
    // Check if currency formatted
    if (validValues.some(v => v.toString().includes('$'))) return 'currency';
    return 'number';
  }

  const isDate = validValues.every(v => !isNaN(Date.parse(v)));
  if (isDate) return 'date';

  // Heuristic for Tags: short strings with low cardinality
  const uniqueValues = new Set(validValues);
  const isShort = validValues.every(v => v.toString().length < 20);
  if (isShort && uniqueValues.size < validValues.length / 2) return 'tag';

  return 'text';
};

// Helper to structure raw array data (e.g. from AI) into TableRow/TableColumn
export const structureRawData = (headers: string[], rowsArray: string[][]): { rows: TableRow[], columns: TableColumn[] } => {
  const rows: TableRow[] = rowsArray.map(rowValues => {
    const row: TableRow = { id: generateId() };
    headers.forEach((header, idx) => {
      row[header] = rowValues[idx] || '';
    });
    return row;
  });

  const columns: TableColumn[] = headers.map(header => ({
    key: header,
    label: header,
    type: detectType(rows.map(r => r[header]))
  }));

  return { rows, columns };
};

export const parseCSV = (content: string): { rows: TableRow[], columns: TableColumn[] } => {
  const rowsData: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  // Iterate character by character to handle quotes and newlines properly
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Handle escaped quotes ("")
        currentCell += '"';
        i++; 
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // End of cell
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      // End of row
      if (char === '\r' && nextChar === '\n') i++; // Skip \n in \r\n
      currentRow.push(currentCell);
      rowsData.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  
  // Handle last cell/row if file doesn't end with newline
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rowsData.push(currentRow);
  }

  // Validate data
  if (rowsData.length === 0) throw new Error("File appears empty");

  // Extract headers and normalize rows
  // Remove empty rows that might occur due to trailing newlines
  const validRowsData = rowsData.filter(r => r.length > 0 && (r.length > 1 || r[0] !== ''));
  
  if (validRowsData.length === 0) throw new Error("No valid data found");

  const headers = validRowsData[0].map(h => h.trim());
  const rows: TableRow[] = [];

  for (let i = 1; i < validRowsData.length; i++) {
    const rowValues = validRowsData[i];
    // Relaxed length check: allow rows that match header count exactly or have trailing empty value
    if (rowValues.length === headers.length || (rowValues.length === headers.length + 1 && rowValues[headers.length] === '')) {
       const row: TableRow = { id: generateId() };
       headers.forEach((h, idx) => row[h] = rowValues[idx] || '');
       rows.push(row);
    }
  }

  const columns: TableColumn[] = headers.map(header => ({
    key: header,
    label: header.charAt(0).toUpperCase() + header.slice(1),
    type: detectType(rows.map(r => r[header]))
  }));

  return { rows, columns };
};

export const parseHTML = (content: string): { rows: TableRow[], columns: TableColumn[] } => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const table = doc.querySelector('table');
  
  if (!table) throw new Error("No table found in HTML file");

  const rows: TableRow[] = [];
  const headers: string[] = [];
  
  // Parse Headers
  const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
  if (!headerRow) throw new Error("Table has no rows");

  headerRow.querySelectorAll('th, td').forEach((cell, idx) => {
    headers.push(cell.textContent?.trim() || `Column ${idx + 1}`);
  });

  // Parse Body
  const bodyRows = table.querySelectorAll('tbody tr');
  const rowsToProcess = bodyRows.length > 0 ? bodyRows : table.querySelectorAll('tr:not(:first-child)');

  rowsToProcess.forEach(tr => {
    const row: TableRow = { id: generateId() };
    const cells = tr.querySelectorAll('td');
    let hasData = false;
    
    cells.forEach((cell, idx) => {
      if (headers[idx]) {
        row[headers[idx]] = cell.textContent?.trim() || '';
        if (row[headers[idx]]) hasData = true;
      }
    });

    if (hasData) rows.push(row);
  });

  const columns: TableColumn[] = headers.map(header => ({
    key: header,
    label: header,
    type: detectType(rows.map(r => r[header]))
  }));

  return { rows, columns };
};