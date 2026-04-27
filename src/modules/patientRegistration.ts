import { PatientModel } from "#models/Patient.js";
import { getContext, createNewContext } from "#modules/contextManager.js"
export async function registerPatient(name: string, number: string, procedure: string, procedureDate: Date, history: string, notes: string) {
    let randomString = Math.random().toString(36).slice(2, 10);
    let userId = `${name}:${number}:${randomString}`;
    let patient = await PatientModel.create({ userId, name, number, procedure, procedureDate, history, notes })
    let context = await getContext(number);
    if (!context) {
        context = await createNewContext(number);
    }
    return { patient, context };
}