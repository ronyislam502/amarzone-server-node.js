import nodemailer from "nodemailer";
import config from "../config";

const sendEmail = async (email: string, html: string) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com.",
    port: 587,
    secure: config.NODE_ENV === "production",
    auth: {
      // TODO: replace `user` and `pass` values from <https://forwardemail.net>
      user: config.sender_email,
      pass: config.sender_app_password,
    },
  });

  await transporter.sendMail({
    from: '"EatHub" <ronyislam502@gmail.com>', // sender address
    to: email,
    subject: "Reset your password Link!", // Subject line
    text: "", // plain text body
    html, // html body
  });
};

export default sendEmail;
