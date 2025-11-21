import { GoogleGenAI } from "@google/genai";
import { AIInsight, TableRow, ParsedData } from "../types";
import { structureRawData } from "../utils/parser";

const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const parseDocumentWithAI = async (
  fileBase64: string,
  mimeType: string
): Promise<{ rows: TableRow[], columns: ParsedData['columns'] }> => {
  const ai = getAI();
  
  const prompt = `
    You are a precise data extraction assistant. 
    Extract the main tabular data from this document.
    If there are multiple tables, extract the most significant one containing data records.
    
    Return ONLY a valid JSON object with exactly this structure:
    {
      "headers": ["Column1", "Column2", ...],
      "rows": [
         ["Row1_Col1_Value", "Row1_Col2_Value", ...],
         ["Row2_Col1_Value", "Row2_Col2_Value", ...]
      ]
    }
    
    Ensure "rows" is an array of arrays of strings, corresponding to the headers order.
    Do not include any markdown formatting or extra text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: fileBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text);
    
    if (!result.headers || !Array.isArray(result.headers) || !result.rows || !Array.isArray(result.rows)) {
      throw new Error("Invalid JSON structure from AI");
    }

    return structureRawData(result.headers, result.rows);

  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    throw new Error("Failed to parse document with AI. Please ensure the document contains a clear table.");
  }
};

export const analyzeTableData = async (
  headers: string[],
  rows: TableRow[]
): Promise<AIInsight> => {
  const ai = getAI();

  // Limit data sent to API to avoid token limits, just sample the first 10 rows
  const sampleData = rows.slice(0, 10).map(row => {
    const { id, ...rest } = row; // Remove internal ID
    return rest;
  });

  const prompt = `
    Analyze the following tabular data sample. 
    Headers: ${headers.join(', ')}
    Sample Data: ${JSON.stringify(sampleData)}
    
    Please provide:
    1. A professional summary of what this data represents (max 2 sentences).
    2. A catchy, professional title for this dataset.
    
    Return response in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const result = JSON.parse(text);
    return {
      summary: result.summary || "Analysis unavailable.",
      suggestedTitle: result.title || result.suggestedTitle || "Untitled Data Table"
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      summary: "Could not analyze data at this time.",
      suggestedTitle: "Imported Data Table"
    };
  }
};