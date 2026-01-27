/**
 * Email Manager
 * Handles email summary generation and sending via EmailJS
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://www.emailjs.com/
 * 2. Create a free account
 * 3. Add an email service (Gmail, Outlook, etc.)
 * 4. Create an email template with these variables:
 *    - {{to_email}} - Recipient email
 *    - {{subject}} - Email subject
 *    - {{message_html}} - HTML formatted message
 * 5. Get your Public Key, Service ID, and Template ID
 * 6. Replace the placeholders below
 */

const EmailManager = {
    // EmailJS Configuration
    PUBLIC_KEY: 'IBFD074mPGTIv4xUU',
    SERVICE_ID: 'service_s4wgj3v',
    TEMPLATE_ID: 'template_8wjd81m',

    isInitialized: false,

    // Initialize EmailJS
    async init() {
        return new Promise((resolve, reject) => {
            if (this.PUBLIC_KEY === 'YOUR_EMAILJS_PUBLIC_KEY') {
                console.warn('EmailJS not configured. Email functionality disabled.');
                resolve(false);
                return;
            }

            // Load EmailJS SDK
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
            script.async = true;
            script.onload = () => {
                if (typeof emailjs !== 'undefined') {
                    emailjs.init(this.PUBLIC_KEY);
                    this.isInitialized = true;
                    resolve(true);
                } else {
                    reject(new Error('EmailJS failed to load'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load EmailJS'));
            document.head.appendChild(script);
        });
    },

    // Generate email summary HTML
    generateSummary(huddleData, patients) {
        const date = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let html = `
            <h3>Evening Huddle Summary - ${date}</h3>
        `;

        // PMT Issues
        const pmtItems = huddleData.pmtIssues || [];
        if (pmtItems.length > 0) {
            html += `
                <div class="section-title">💰 PMT Issues (${pmtItems.length})</div>
                <ul>
                    ${pmtItems.map(item => `<li><strong>${item.patientName}</strong>: ${item.note || 'Needs follow-up'}</li>`).join('')}
                </ul>
            `;
        }

        // Insurance Questions
        const insQuestions = huddleData.insuranceQuestions || [];
        if (insQuestions.length > 0) {
            html += `
                <div class="section-title">🏥 Insurance Questions (${insQuestions.length})</div>
                <ul>
                    ${insQuestions.map(item => `<li><strong>${item.patientName}</strong>: ${item.note || 'Needs follow-up'}</li>`).join('')}
                </ul>
            `;
        }

        // No Appt
        const noApptItems = huddleData.noAppt || [];
        if (noApptItems.length > 0) {
            html += `
                <div class="section-title">📵 No Appt (${noApptItems.length})</div>
                <ul>
                    ${noApptItems.map(item => `<li><strong>${item.patientName}</strong>: ${item.note || 'No appointment scheduled'}</li>`).join('')}
                </ul>
            `;
        }

        // Charge and Passdown
        const chargeItems = huddleData.chargePassdown || [];
        if (chargeItems.length > 0) {
            html += `
                <div class="section-title">📋 Charge and Passdown (${chargeItems.length})</div>
                <ul>
                    ${chargeItems.map(item => {
                        const codes = (item.codes || []).join(', ');
                        const note = item.note ? ` - ${item.note}` : '';
                        return `<li><strong>${item.patientName}</strong>: ${codes}${note}</li>`;
                    }).join('')}
                </ul>
            `;
        }

        // 24 Hour To-Do
        const todoItems = huddleData.todo24 || [];
        if (todoItems.length > 0) {
            html += `
                <div class="section-title">📝 24 Hour To-Do (${todoItems.length})</div>
                <ul>
                    ${todoItems.map(item => `<li>${item.task}</li>`).join('')}
                </ul>
            `;
        }

        // Chiro 180 Updates
        const chiro180 = huddleData.chiro180 || {};
        const needsUpdate = Object.entries(chiro180).filter(([_, status]) => status === 'needs-update');
        if (needsUpdate.length > 0) {
            html += `
                <div class="section-title">📱 Chiro 180 - Needs Update (${needsUpdate.length})</div>
                <ul>
                    ${needsUpdate.map(([patient]) => `<li>${patient}</li>`).join('')}
                </ul>
            `;
        }

        // Insurance Verification
        const insVerify = huddleData.insuranceVerify || {};
        const notVerified = Object.entries(insVerify).filter(([_, verified]) => !verified);
        if (notVerified.length > 0) {
            html += `
                <div class="section-title">✅ Insurance Verification Needed (${notVerified.length})</div>
                <ul>
                    ${notVerified.map(([patient]) => `<li>${patient}</li>`).join('')}
                </ul>
            `;
        }

        // Summary stats
        const totalItems = pmtItems.length + insQuestions.length + noApptItems.length +
                          chargeItems.length + todoItems.length + needsUpdate.length + notVerified.length;

        if (totalItems === 0) {
            html += `<p><em>No action items recorded for today's huddle.</em></p>`;
        }

        html += `
            <hr style="margin-top: 20px; border: none; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
                Generated by Chiro Huddle • ${patients.length} patients reviewed
            </p>
        `;

        return html;
    },

    // Generate plain text version
    generatePlainText(huddleData, patients) {
        const date = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let text = `EVENING HUDDLE SUMMARY - ${date}\n\n`;

        // PMT Issues
        const pmtItems = huddleData.pmtIssues || [];
        if (pmtItems.length > 0) {
            text += `PMT ISSUES (${pmtItems.length})\n`;
            pmtItems.forEach(item => {
                text += `  • ${item.patientName}: ${item.note || 'Needs follow-up'}\n`;
            });
            text += '\n';
        }

        // Insurance Questions
        const insQuestions = huddleData.insuranceQuestions || [];
        if (insQuestions.length > 0) {
            text += `INSURANCE QUESTIONS (${insQuestions.length})\n`;
            insQuestions.forEach(item => {
                text += `  • ${item.patientName}: ${item.note || 'Needs follow-up'}\n`;
            });
            text += '\n';
        }

        // No Appt
        const noApptItems = huddleData.noAppt || [];
        if (noApptItems.length > 0) {
            text += `NO APPT (${noApptItems.length})\n`;
            noApptItems.forEach(item => {
                text += `  • ${item.patientName}: ${item.note || 'No appointment scheduled'}\n`;
            });
            text += '\n';
        }

        // Charge and Passdown
        const chargeItems = huddleData.chargePassdown || [];
        if (chargeItems.length > 0) {
            text += `CHARGE AND PASSDOWN (${chargeItems.length})\n`;
            chargeItems.forEach(item => {
                const codes = (item.codes || []).join(', ');
                const note = item.note ? ` - ${item.note}` : '';
                text += `  • ${item.patientName}: ${codes}${note}\n`;
            });
            text += '\n';
        }

        // 24 Hour To-Do
        const todoItems = huddleData.todo24 || [];
        if (todoItems.length > 0) {
            text += `24 HOUR TO-DO (${todoItems.length})\n`;
            todoItems.forEach(item => {
                text += `  • ${item.task}\n`;
            });
            text += '\n';
        }

        // Chiro 180 Updates
        const chiro180 = huddleData.chiro180 || {};
        const needsUpdate = Object.entries(chiro180).filter(([_, status]) => status === 'needs-update');
        if (needsUpdate.length > 0) {
            text += `CHIRO 180 - NEEDS UPDATE (${needsUpdate.length})\n`;
            needsUpdate.forEach(([patient]) => {
                text += `  • ${patient}\n`;
            });
            text += '\n';
        }

        // Insurance Verification
        const insVerify = huddleData.insuranceVerify || {};
        const notVerified = Object.entries(insVerify).filter(([_, verified]) => !verified);
        if (notVerified.length > 0) {
            text += `INSURANCE VERIFICATION NEEDED (${notVerified.length})\n`;
            notVerified.forEach(([patient]) => {
                text += `  • ${patient}\n`;
            });
            text += '\n';
        }

        text += `---\nGenerated by Chiro Huddle • ${patients.length} patients reviewed`;

        return text;
    },

    // Send email via EmailJS
    async sendSummary(huddleData, patients, recipientEmail) {
        // If EmailJS not configured, use mailto fallback
        if (!this.isInitialized || this.PUBLIC_KEY === 'YOUR_EMAILJS_PUBLIC_KEY') {
            return this.sendViaMailto(huddleData, patients, recipientEmail);
        }

        const date = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const templateParams = {
            to_email: recipientEmail,
            subject: `Evening Huddle Summary - ${date}`,
            message_html: this.generateSummary(huddleData, patients)
        };

        try {
            await emailjs.send(this.SERVICE_ID, this.TEMPLATE_ID, templateParams);
            return true;
        } catch (error) {
            console.error('EmailJS error:', error);
            // Fallback to mailto
            return this.sendViaMailto(huddleData, patients, recipientEmail);
        }
    },

    // Fallback: Open default email client
    sendViaMailto(huddleData, patients, recipientEmail) {
        const date = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const subject = encodeURIComponent(`Evening Huddle Summary - ${date}`);
        const body = encodeURIComponent(this.generatePlainText(huddleData, patients));

        const mailtoUrl = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
        window.location.href = mailtoUrl;

        return true;
    }
};

// Initialize EmailJS on load (non-blocking)
document.addEventListener('DOMContentLoaded', () => {
    EmailManager.init().catch(e => console.warn('EmailJS init failed:', e));
});

// Make available globally
window.EmailManager = EmailManager;
