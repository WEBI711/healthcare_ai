import mongoose, { Schema, Document } from 'mongoose';

export interface IPatientInfoSchema extends Document {
    userId: string;
    name: string;
    number: string;
    procedure: string;
    procedureDate: Date;
    history: string;
    notes: string;
}

const PatientInfoSchema = new mongoose.Schema<IPatientInfoSchema>({
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    number: { type: String, required: true },
    procedure: { type: String, required: true },
    procedureDate: { type: Date, required: true },
    history: { type: String, required: false },
    notes: { type: String, required: false },
}, {
    timestamps: true,
});

export const PatientModel = mongoose.model<IPatientInfoSchema>('PatientInfo', PatientInfoSchema);