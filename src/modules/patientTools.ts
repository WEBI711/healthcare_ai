import { Type, Tool } from '@mariozechner/pi-ai';
import { PatientModel } from '#database/index.js';

const updatePatientInfoTool: Tool = {
    name: 'update_patient_info',
    description: `Update a patient's recovery notes or medical history.
You must confirm with the patient before updating any field.
Only the 'notes' and 'history' fields can be updated through this tool.`,
    parameters: Type.Object({
        notes: Type.Optional(Type.String({
            description: 'New clinical notes. Only provide if updating notes.'
        })),
        history: Type.Optional(Type.String({
            description: 'New medical history information. Only provide if updating history.'
        })),
    })
};

export const patientToolDefinitions: Tool[] = [
    updatePatientInfoTool,
];

// Tool execution handlers
export async function executePatientTool(
    toolName: string,
    args: { notes?: string; history?: string },
    userId: string
): Promise<string> {
    console.log(`[PatientTool] Executing tool: ${toolName}`, { userId, args });

    switch (toolName) {
        case 'update_patient_info': {
            const updates: Record<string, string> = {};
            if (args.notes !== undefined) updates.notes = args.notes;
            if (args.history !== undefined) updates.history = args.history;

            if (Object.keys(updates).length === 0) {
                return '⚠️ No fields were provided to update. Please specify notes or history.';
            }

            try {
                const updated = await PatientModel.findOneAndUpdate(
                    { userId },
                    { $set: updates },
                    { new: true }
                );

                if (!updated) {
                    return '❌ Could not find your patient record. Please contact support.';
                }

                const updatedFields = Object.keys(updates).join(' and ');
                return `✅ Updated your ${updatedFields} successfully.`;
            } catch (error: any) {
                return `❌ Failed to update your record: ${error.message}`;
            }
        }

        default:
            return `Unknown patient tool: ${toolName}`;
    }
}
