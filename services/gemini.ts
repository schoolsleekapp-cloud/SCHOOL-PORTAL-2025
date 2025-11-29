
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, Trait, Question } from "../types";

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

export const generateExamQuestions = async (
  topicOrNotes: string,
  classLevel: string,
  subject: string,
  count: number = 10,
  mode: 'objective' | 'theory' | 'comprehension' = 'objective'
): Promise<Question[]> => {
  if (!apiKey) {
    throw new Error("API Key Missing");
  }

  let prompt = '';
  let responseSchema = {};

  // Common Constraint ensuring strict adherence to uploaded content
  const strictConstraint = `
    IMPORTANT INSTRUCTION:
    - You must strictly generate questions ONLY based on the "Context/Lesson Notes" provided below.
    - Do NOT use outside knowledge, facts not present in the text, or general knowledge.
    - If the provided text is insufficient to generate ${count} questions, generate as many as possible based strictly on the text.
    - Ensure the language and complexity matches a ${classLevel} student.
  `;

  if (mode === 'theory') {
    prompt = `
      Create a ${count}-question Essay/Theory Examination for a ${classLevel} student on the subject of ${subject}.
      
      ${strictConstraint}

      Context/Lesson Notes:
      "${topicOrNotes}"

      Requirements:
      1. Generate exactly ${count} questions (or fewer if content is limited).
      2. Questions should require written explanations.
      3. Provide a 'correctAnswer' field which contains the Model Answer or Marking Guide found in the text.
      4. No options are required.
      
      Return pure JSON format array.
    `;
    
    responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          questionText: { type: Type.STRING },
          correctAnswer: { type: Type.STRING }
        },
        required: ['id', 'questionText', 'correctAnswer']
      }
    };
  } else if (mode === 'comprehension') {
    // Comprehension treats the notes as a strict passage
    prompt = `
      Create a ${count}-question Reading Comprehension Examination for a ${classLevel} student.
      
      ${strictConstraint}

      Passage / Content:
      "${topicOrNotes}"

      Requirements:
      1. Generate exactly ${count} Multiple Choice questions based *strictly* on the passage above.
      2. Each question must have 4 options.
      3. Clearly indicate the correct answer found in the passage.
      4. The correct answer MUST be one of the options provided.
      
      Return pure JSON format array.
    `;

    responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          questionText: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.STRING }
        },
        required: ['id', 'questionText', 'options', 'correctAnswer']
      }
    };
  } else {
    // Default Objective
    prompt = `
      Create a ${count}-question Multiple Choice Examination for a ${classLevel} student on the subject of ${subject}.
      
      ${strictConstraint}

      Context/Lesson Notes:
      "${topicOrNotes}"

      Requirements:
      1. Generate exactly ${count} questions.
      2. Each question must have 4 options.
      3. Clearly indicate the correct answer.
      4. The correct answer MUST be one of the options provided.
      
      Return pure JSON format array.
    `;

    responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          questionText: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.STRING }
        },
        required: ['id', 'questionText', 'options', 'correctAnswer']
      }
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema as any
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as Question[];
    }
    throw new Error("Failed to generate questions");
  } catch (error) {
    console.error("Gemini Question Gen Error:", error);
    throw error;
  }
};
