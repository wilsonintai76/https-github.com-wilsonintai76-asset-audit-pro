# Implementation Plan: Strategic Report Persistence & AI Hardening

Resolve the issue where the Strategic Audit Memorandum disappears and fix the AI analysis failure ("Invalid JSON") for large institutional datasets.

## User Review Required

> [!IMPORTANT]
> The "Generate Simulation Report" / "Print Final Approval Memo" button will be moved from the bottom sidebar to the main **Header** (next to the Print button) for better accessibility as requested.

## Proposed Changes

### Global Data & State Layer

#### [MODIFY] [useAppData.ts](file:///c:/Users/SMK%20St.%20Thomas/OneDrive/Documents/Inspect-able/src/client/hooks/useAppData.ts)
- Add `feasibilityReport` and `setFeasibilityReport` to the global `useAppData` hook.
- This ensures the report data is preserved even if the user re-renders the pairing dashboard or switches views.

### Management UI (Frontend)

#### [MODIFY] [CrossAuditManagement.tsx](file:///c:/Users/SMK%20St.%20Thomas/OneDrive/Documents/Inspect-able/src/client/components/CrossAuditManagement.tsx)
- **State Migration**: Remove local `feasibilityReport` state and use the global one from `appData`.
- **UI Redesign**: 
    - Move the "Generate Simulation Report" / "Print Final Approval Memo" button to the `PageHeader` next to the `Print` button.
    - Remove the redundant button from the bottom of the "Controls" sidebar to reduce clutter.

### AI Strategic Engine (Backend)

#### [MODIFY] [compute.ts](file:///c:/Users/SMK%20St.%20Thomas/OneDrive/Documents/Inspect-able/src/server/routes/compute.ts)
- **Model Hardening**: 
    - Improve the `extractJson` logic to handle cases where the AI might include conversational text before/after the JSON block more robustly.
    - Switch to `@cf/meta/llama-3-8b-instruct` or standardize on a high-token-limit model.
- **Prompt Optimization**:
    - If the number of departments is very high (>40), include a summary instead of a full list in the prompt to avoid context overflow which causes the model to fail outputting JSON.

## Verification Plan

### Automated Verification
- **Run AI Analysis**: Verify that the "Refresh Strategy" button now returns valid JSON even for large data sets.
- **Simulation Persistence**: Run a simulation, then change a constraint and verify the report doesn't vanish.

### Manual Verification
- Confirm the new button placement next to the "Print" button in the dashboard header.
- Confirm that the "Strategic Strategy" score remains visible after locking a plan.
