import nodemailer from 'nodemailer';

const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

export const sendShareNotification = async (toEmail, ownerName, documentTitle, inviteLink) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("Email service is not configured. Skipping share notification.");
        return;
    }
    const transporter = createTransporter();
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: `${ownerName} shared a document with you: ${documentTitle}`,
        html: `
            <h2>${ownerName} has invited you to collaborate!</h2>
            <p>You have been invited to edit the document: <strong>${documentTitle}</strong></p>
            <p>Log in to your dashboard to accept the invitation and start collaborating.</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Error sending share notification email:", error);
    }
};

export const sendInviteToUnregistered = async (toEmail, ownerName, documentTitle, registerLink) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("Email service is not configured. Skipping invite notification.");
        return;
    }
    const transporter = createTransporter();
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: `${ownerName} invited you to collaborate on ${documentTitle}`,
        html: `
            <h2>${ownerName} has invited you to collaborate!</h2>
            <p>You have been invited to edit the document: <strong>${documentTitle}</strong></p>
            <p>To access this document, please register an account first.</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/register" style="display: inline-block; padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px;">Register Now</a>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Error sending invite email:", error);
    }
};

export const sendRejectionNotification = async (ownerEmail, rejectorName, documentTitle) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("Email service is not configured. Skipping rejection notification.");
        return;
    }
    const transporter = createTransporter();
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: ownerEmail,
        subject: `Collaboration Invite Rejected: ${documentTitle}`,
        html: `
            <h2>Invitation Rejected</h2>
            <p><strong>${rejectorName}</strong> has declined your invitation to collaborate on the document: <strong>${documentTitle}</strong>.</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Error sending rejection notification email:", error);
    }
};
