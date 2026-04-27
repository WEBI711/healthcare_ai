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
}, {
    timestamps: true,
});

export const PatientModel = mongoose.model<IPatientInfoSchema>('PatientInfo', PatientInfoSchema);