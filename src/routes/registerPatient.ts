// src/routes/userRoutes.ts
import { Router } from 'express';
import { IPatientInfoSchema } from '#database/index.js'
import express, { Request, Response } from 'express';
import { registerPatient } from '#modules/patientRegistration.js';

const router = Router();
// for reference regarding how to use mongoose schema types for request bodies
//type Body = Omit<IPatientInfoSchema, 'userId' | '_id' | '__v' | 'createdAt' | 'updatedAt'>;
type Body = { name: string, number: string; procedure: string, procedureDate: Date, history: string, notes: string };

router.post('/', async (req: Request<{}, {}, Body>, res) => {
    try {
        const { name, number, procedure, procedureDate, history, notes } = req.body;
        let { patient, isNew } = await registerPatient(name, number, procedure, procedureDate, history, notes);
        if (patient) {
            console.log(`Patient ${isNew ? 'registered' : 'already exists'}:`, patient.name);
            res.status(201).json({
              message: isNew ? "Patient registered successfully" : "Patient already exists",
              name: patient.name,
              isNew
            })
            return
        }
    } catch (err) {
        console.error("Error registering patient in registerPatient post endpoint")
        console.error(err)
        res.status(500).send({ error: err, body: req.body })
        return
    }
    res.status(500).send({ errorMessage: "Issue registering patient in registerPatient post endpoint", body: req.body })
});

export default router;