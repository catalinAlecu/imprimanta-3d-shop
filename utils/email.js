import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendFirstEmail = async (userEmail, userName) => {
    try {
        const { data, error } = await resend.emails.send({
            from: '3D Print Shop <contact@clinicata.site>',
            to: [userEmail],
            subject: 'Bine ai venit pe platforma 3D Print Shop!',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Salut, ${userName || 'utilizatorule'}!</h2>
                    <p>Contul tau a fost creat cu succes.</p>
                </div>
            `
        });

        if (error) {
            return console.error('Eroare Resend:', error);
        }

        console.log('Email trimis cu succes prin Resend:', data.id);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};