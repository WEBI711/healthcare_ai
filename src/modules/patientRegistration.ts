import { PatientModel } from "#models/Patient.js";
import { check_if_allowed, allow } from "#modules/allowlist_manager.js";
export async function registerPatient(name: string, number: string, procedure: string, procedureDate: Date, history: string, notes: string) {
    let randomString = Math.random().toString(36).slice(2, 10);
    let userId = `${name}:${number}:${randomString}`;
    let patient = await PatientModel.create({ userId, name, number, procedure, procedureDate, history, notes })
    let isAllowed = await check_if_allowed(number);
    if (!isAllowed)
        await allow(number);
    return { patient };
}