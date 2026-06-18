import { PatientModel } from "#models/Patient.js";
import { check_if_allowed, allow } from "#modules/allowlist_manager.js";
import { whatsAppService } from "#modules/whatsappService.js";

export async function registerPatient(name: string, number: string, procedure: string, procedureDate: Date, history: string, notes: string) {
    let randomString = Math.random().toString(36).slice(2, 10);
    let userId = `${name}:${number}:${randomString}`;
    let patient = await PatientModel.create({ userId, name, number, procedure, procedureDate, history, notes })
    let isAllowed = await check_if_allowed(number);
    if (!isAllowed)
        await allow(number);

    // Send a welcome/introductory WhatsApp message to the newly registered patient
    // Registration succeeds regardless — the welcome message is best-effort
    if (whatsAppService.isConnected()) {
        sendWelcomeMessage(name, number, procedure, procedureDate).catch(err =>
            console.error(`[Registration] Welcome message failed for ${name} (${number}):`, err)
        );
    } else {
        console.log(`[Registration] WhatsApp socket not connected — skipping welcome message for ${name} (${number})`);
    }

    return { patient };
}

function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Builds and sends a warm introductory WhatsApp message to a newly registered patient.
 */
async function sendWelcomeMessage(
    name: string,
    number: string,
    procedure: string,
    procedureDate: string | Date
): Promise<void> {
    try {
        const dateStr = formatDate(procedureDate);

        const message = [
            `🫶 *Welcome to CareBot, ${name}!*`,
            ``,
            `I'm your personal AI-powered recovery assistant, and I've been assigned to support you after your *${procedure}* on *${dateStr}*.`,
            ``,
            `─── *You're in the best hands* ───`,
            ``,
            `Your healthcare team has entrusted your care to an excellent doctor who is closely monitoring your recovery. Please always follow their instructions as your primary plan — I'm here to *complement* your care, never override it. If anything feels urgent or concerning, contact your doctor or seek emergency care immediately.`,
            ``,
            `─── *Here's how I can help you* 💙 ───`,
            ``,
            `📅 *Smart Reminders*`,
            `Just say: "Remind me every day at 8am to take my medication" or "Remind me about my follow-up on Friday at 2pm". I'll handle the rest.`,
            ``,
            `🩺 *Recovery Guidance*`,
            `Ask me anything: "Is this swelling normal?" "When can I start walking?" "What foods help healing?" I'll give you tailored advice (and remind you to confirm with your doctor).`,
            ``,
            `📝 *Track Your Progress*`,
            `Tell me how you're feeling and I'll log it in your recovery notes. "I had a rough night with pain" or "My energy is coming back" — I'll keep a record your doctor can review.`,
            ``,
            `⏰ *Appointment & Medication Alerts*`,
            `Set reminders for physio sessions, medication refills, or any follow-ups. You'll never miss a beat.`,
            ``,
            `❓ *General Questions*`,
            `Wondering about wound care, rest positions, diet, or activity limits? Just ask — I've got you covered.`,
            ``,
            `─── *A few important things* ───`,
            ``,
            `⚠️ *I can suggest possible next steps based on what you describe, but always check with your doctor before acting on any diagnosis, treatment, or medication recommendation.*`,
            ``,
            `🚨 *If you experience:* high fever, excessive bleeding, severe pain, shortness of breath, or any symptoms that worry you — *stop chatting and call your doctor or emergency services right away.*`,
            ``,
            `You've got an entire care team behind you. I'm just the friendly voice on WhatsApp available 24/7 to make your recovery smoother. 💪✨`,
            ``,
            `*Let's get you back on your feet, ${name}!* Just send me a message whenever you need me. 💬`,
        ].join('\n');

        await whatsAppService.sendMessage(number, message);
        console.log(`[Registration] Welcome message sent to ${name} (${number})`);
    } catch (err) {
        console.error(`[Registration] Failed to send welcome message to ${name} (${number}):`, err);
        // Don't throw — registration should still succeed even if the message fails
    }
}