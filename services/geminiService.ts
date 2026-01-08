
import { GoogleGenAI, Type } from "@google/genai";
import { AuditSchedule, AuditInsight } from "../types";

// Always initialize GoogleGenAI with a named parameter for the API key from process.env.API_KEY
export const analyzeSchedule = async (schedules: AuditSchedule[]): Promise<AuditInsight> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const scheduleText = schedules.map(s => 
    `Location: ${s.location}, Supervisor: ${s.supervisor}, Auditors: [${s.auditor1 || 'Empty'}, ${s.auditor2 || 'Empty'}], Date: ${s.date}`
  ).join('\n');

  try {
    // Upgraded to gemini-3-pro-preview for advanced reasoning and recommendation tasks
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze the following asset audit schedule and provide a high-level summary and 3 key recommendations for better resource allocation or risk mitigation. Focus on unassigned slots and upcoming deadlines:\n\n${scheduleText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["summary", "recommendations"]
        }
      }
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error("No response text from AI");
    }

    const result = JSON.parse(text);
    return {
      summary: result.summary || "Unable to generate summary.",
      recommendations: result.recommendations || []
    };
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return {
      summary: "The AI assistant is currently unavailable. Please review the schedule manually.",
      recommendations: ["Ensure all locations have at least one auditor.", "Balance workload across dates.", "Follow up with supervisors of overdue audits."]
    };
  }
};
