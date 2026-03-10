
import { GoogleGenAI, Type } from "@google/genai";
import { AuditSchedule, AuditInsight } from "../types";

// Always initialize GoogleGenAI with a named parameter for the API key from process.env.API_KEY
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSchedule = async (schedules: AuditSchedule[]): Promise<AuditInsight> => {
  const ai = getAI();
  
  // Filter for relevant audits to analyze (Pending/In Progress) to keep context focused
  const activeSchedules = schedules.filter(s => s.status !== 'Completed');
  
  // Create a concise text representation
  const scheduleText = activeSchedules.map(s => 
    `- [${s.date || 'Unscheduled'}] ${s.departmentId} (${s.locationId}): ${!s.auditor1Id && !s.auditor2Id ? 'NO AUDITORS' : (s.auditor1Id ? '1' : '0') + (s.auditor2Id ? '+1' : '') + ' assigned'}`
  ).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an Audit Operations Risk Analyst. Analyze the following audit schedule (Pending/In Progress items).
      
      Identify:
      1. Immediate Risks: Unassigned slots for dates that are close (today is ${new Date().toISOString().split('T')[0]}).
      2. Bottlenecks: Departments with disproportionately high pending counts.
      3. Compliance Gaps: Locations with zero auditors assigned.

      Return a JSON object with:
      - "summary": A 1-sentence executive summary of the current risk level (Low/Medium/High) and why.
      - "recommendations": An array of 3 specific, actionable steps to resolve the biggest blockers.

      Data:
      ${scheduleText}`,
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
      summary: result.summary || "Analysis complete.",
      recommendations: result.recommendations || []
    };
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return {
      summary: "The AI assistant is currently offline.",
      recommendations: ["Check manual schedule for conflicts.", "Ensure all high-priority locations have auditors.", "Verify certification status of team members."]
    };
  }
};

export const parseSearchQuery = async (query: string, validDepartments: string[]) => {
  const ai = getAI();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User Search: "${query}"
      
      Map this search query to the following filters:
      1. Department: Must match exactly one of these values: ${JSON.stringify(validDepartments)}. If vague (e.g., "Electrical"), map to nearest match ("Jabatan Kejuruteraan Elektrik"). If no match, return "All".
      2. Status: "Pending", "In Progress", "Completed", or "All".
      3. Text: Any specific person name or location mentioned.

      Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            department: { type: Type.STRING },
            status: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ["department", "status", "text"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Smart search failed", error);
    return { department: 'All', status: 'All', text: query };
  }
};

export const generateAuditReport = async (audit: AuditSchedule): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a formal "Audit Completion Certificate" text for the following completed audit.
      
      Context:
      - Location: ${audit.locationId}
      - Department: ${audit.departmentId}
      - Date Completed: ${audit.date}
      - Auditors: ${audit.auditor1Id || 'N/A'} and ${audit.auditor2Id || 'N/A'}
      - Supervisor (Site): ${audit.supervisorId}
      - ID: ${audit.id}

      Format:
      - Start with a formal uppercase header "OFFICIAL AUDIT RECORD".
      - Include a "Certification Statement" declaring the assets verified.
      - Include a "Scope of Verification" section summarizing the department and location.
      - End with a placeholder for "Digital Signature".
      - Keep the tone highly professional, bureaucratic, and authoritative.
      - Do not use markdown bolding/italics, just plain text layout.`,
    });
    return response.text || "Report generation failed.";
  } catch (error) {
    console.error("Report generation failed", error);
    return "Error: Could not generate report at this time.";
  }
};
