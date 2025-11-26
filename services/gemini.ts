import { GoogleGenAI, Type } from "@google/genai";
import { Subject, Trait } from "../types";

// Vite uses import.meta.env for environment variables. 
// We fallback to process.env for local non-Vite environments if needed.
const apiKey = (import.meta as any).env?.VITE_API_KEY || process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export interface RemarksResponse {
  principalRemark: string;
  teacherRemark: string;
}

export const generateGeminiRemarks = async (
  studentName: string,
  subjects: Subject[],
  level: string,
  position: string,
  affective: Trait[]
): Promise<RemarksResponse> => {
  if (!apiKey) {
    console.warn("Gemini API Key is missing. Ensure VITE_API_KEY is set in Vercel environment variables.");
    return {
      principalRemark: "Good result, keep it up.",
      teacherRemark: "A diligent student."
    };
  }

  const performanceSummary = subjects.map(s => `${s.name}: ${s.total}`).join(", ");
  const behaviorScore = affective ? affective.reduce((acc, curr) => acc + curr.rating, 0) / affective.length : 3;
  const behaviorText = behaviorScore > 4 ? "Excellent behavior" : behaviorScore > 3 ? "Good behavior" : "Needs behavioral improvement";

  const prompt = `
    You are an experienced Principal at a Nigerian School.
    Student Name: ${studentName}
    Class: ${level}
    Position in Class: ${position}
    Behavior: ${behaviorText}
    Scores: ${performanceSummary}

    Task:
    1. Write a "Principal's Remark" (formal, assessing overall performance).
    2. Write a "Class Teacher's Remark" (encouraging, specific to strengths/weaknesses and behavior).
    
    Keep it concise (max 15 words each) to fit on a report sheet. Use Nigerian school terminology.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            principalRemark: { type: Type.STRING },
            teacherRemark: { type: Type.STRING },
          },
          required: ['principalRemark', 'teacherRemark']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as RemarksResponse;
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      principalRemark: "Good result, keep it up.",
      teacherRemark: "A diligent student."
    };
  }
};