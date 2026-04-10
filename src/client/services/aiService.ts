import { AuditSchedule, AuditInsight } from '@shared/types';
import { api, getAuthHeaders } from './honoClient';

export const analyzeSchedule = async (schedules: AuditSchedule[]): Promise<AuditInsight> => {
  try {
    const res = await (api as any).ai.analyze.$post(
      { json: { schedules } },
      { headers: await getAuthHeaders() }
    );
    if (!res.ok) throw new Error('AI analyze failed');
    return await res.json() as AuditInsight;
  } catch {
    return {
      summary: 'The AI assistant is currently offline.',
      recommendations: ['Check manual schedule for conflicts.', 'Ensure all high-priority locations have auditors.', 'Verify certification status of team members.']
    };
  }
};

export const parseSearchQuery = async (query: string, validDepartments: string[]) => {
  try {
    const res = await (api as any).ai.search.$post(
      { json: { query, validDepartments } },
      { headers: await getAuthHeaders() }
    );
    if (!res.ok) throw new Error('AI search failed');
    return await res.json();
  } catch {
    return { department: 'All', status: 'All', text: query };
  }
};

export const generateAuditReport = async (audit: AuditSchedule): Promise<string> => {
  try {
    const res = await (api as any).ai.report.$post(
      { json: { audit } },
      { headers: await getAuthHeaders() }
    );
    if (!res.ok) throw new Error('AI report failed');
    const data = await res.json() as { report: string };
    return data.report;
  } catch {
    return 'Error: Could not generate report at this time.';
  }
};

export const suggestThresholds = async (departments: any[]) => {
  try {
    const res = await (api as any).ai['suggest-thresholds'].$post(
      { json: { departments } },
      { headers: await getAuthHeaders() }
    );
    if (!res.ok) throw new Error('AI threshold suggestion failed');
    return await res.json() as { assetThreshold: number; megaTargetThreshold: number; reasoning: string };
  } catch (err) {
    console.error('Threshold suggestion error:', err);
    return { assetThreshold: 500, megaTargetThreshold: 3000, reasoning: 'Fallback due to error.' };
  }
};
