import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

console.log("Using EMAIL_USER:", process.env.EMAIL_USER);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER, // sending to self to test
    subject: `Test Email`,
    text: `This is a test email from the backend.`
};

async function testEmail() {
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully!", info.response);
    } catch (error) {
        console.error("Error sending email:");
        console.error(error);
    }
}

testEmail();
