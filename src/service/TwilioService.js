const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const sendSMS = (to, code) => {
  const body = `Tu código de verificación es: ${code}`;
  
  return client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  })
  .then((message) => console.log("Mensaje enviado con SID:", message.sid))
  .catch((error) => console.error("Error al enviar SMS:", error));
};

module.exports = { sendSMS };
