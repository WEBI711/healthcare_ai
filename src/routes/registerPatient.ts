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
        debugger;
        const { name, number, procedure, procedureDate, history, notes } = req.body;
        let { patient, context } = await registerPatient(name, number, procedure, procedureDate, history, notes);
        if (patient && context) {
            console.log("patient registered successfully");
            res.status(200).send();
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