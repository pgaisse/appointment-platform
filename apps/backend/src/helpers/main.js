// runMatchingAppointments.js
const mongoose = require("mongoose");
const { findMatchingAppointments } = require("./findMatchingAppointments");

// Cambia esto si tu base no es "admin"
const mongoURI = "mongodb://admin:Patoch-2202@localhost:27017/admin";

// 🔎 Función utilitaria para validar fechas
function isValidDate(dateString) {
    const d = new Date(dateString);
    return !isNaN(d.getTime());
}

async function main() {

 
    try {
        console.log("🔌 Conectando a MongoDB...");
        await mongoose.connect(mongoURI);
        console.log("✅ Conectado.");

        const result = await findMatchingAppointments();

        console.log("🟢 Resultado:");
        //console.dir(result, { depth: null });

    } catch (err) {
        console.error("❌ Error al ejecutar la función:", err);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Desconectado.");
    }
}

main();
