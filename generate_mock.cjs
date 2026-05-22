const fs = require('fs');

const firstNames = ['Carlos', 'Maria', 'Jose', 'Ana', 'Luis', 'Carmen', 'Jorge', 'Elena', 'Miguel', 'Laura', 'Pedro', 'Marta', 'Alejandro', 'Lucia', 'Jesus', 'Sofia', 'Manuel', 'Valeria', 'Roberto', 'Camila', 'Victor', 'Andrea', 'Diego', 'Isabella', 'Ricardo'];
const lastNames = ['Gonzalez', 'Rodriguez', 'Gomez', 'Fernandez', 'Lopez', 'Diaz', 'Martinez', 'Perez', 'Garcia', 'Sanchez', 'Romero', 'Sosa', 'Ruiz', 'Torres', 'Ramirez', 'Mendoza', 'Acosta', 'Rojas', 'Medina', 'Castillo'];
const banks = ['Banesco', 'Mercantil', 'Provincial', 'Venezuela', 'BNC'];

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const members = [];
const payments = [];

const today = new Date();
// Last 6 months for realistic charts
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(today.getMonth() - 5);
sixMonthsAgo.setDate(1);

let paymentIdCount = 1;

for (let i = 1; i <= 200; i++) {
  const nombre = randomItem(firstNames);
  const apellido = randomItem(lastNames);
  const isInactive = Math.random() < 0.1; // 10% are completely inactive
  
  // Inscripcion sometime in the last 6 months
  const inscripcionDate = randomDate(sixMonthsAgo, today);
  
  const member = {
    id: i,
    nombre: nombre,
    apellido: apellido,
    cedula: `V-${Math.floor(Math.random() * 20000000) + 10000000}`,
    edad: Math.floor(Math.random() * 40) + 18,
    telefono: `0414-${Math.floor(Math.random() * 9000000) + 1000000}`,
    correo: `${nombre.toLowerCase()}.${apellido.toLowerCase()}${i}@email.com`,
    fechaInscripcion: inscripcionDate.toISOString(),
    estado: isInactive ? 'inactivo' : 'activo',
    notas: '',
    createdAt: inscripcionDate.toISOString()
  };
  
  members.push(member);

  if (!isInactive) {
    // Generate payments for this member
    // Find how many months they've been active
    let currDate = new Date(inscripcionDate);
    
    // Some users might have skipped a month, but let's just make them pay until some random point
    // 60% are up to date, 20% expire soon (3 days), 20% are expired
    
    const statusType = Math.random();
    let targetExpiration;
    if (statusType < 0.6) {
      // Active (expires in 5 to 30 days)
      targetExpiration = new Date(today.getTime() + (Math.floor(Math.random() * 25) + 5) * 86400000);
    } else if (statusType < 0.8) {
      // Expiring soon (0 to 3 days)
      targetExpiration = new Date(today.getTime() + (Math.floor(Math.random() * 4)) * 86400000);
    } else {
      // Expired (expired 1 to 20 days ago)
      targetExpiration = new Date(today.getTime() - (Math.floor(Math.random() * 20) + 1) * 86400000);
    }

    // Now step backwards from targetExpiration by 30 days to create history
    let pVencimiento = new Date(targetExpiration);
    while (pVencimiento > currDate) {
      const pPago = new Date(pVencimiento.getTime() - 30 * 86400000);
      if (pPago < sixMonthsAgo) break; // Don't generate too far back
      
      const isMobile = Math.random() < 0.7; // 70% pago movil
      const tasaUsd = (Math.random() * 5 + 35).toFixed(2); // Random rate between 35 and 40
      const montoUsd = 20; // 20$ monthly fee
      
      const payment = {
        id: paymentIdCount++,
        memberId: i,
        montoBs: Math.round(montoUsd * parseFloat(tasaUsd)),
        tasaUsd: parseFloat(tasaUsd),
        montoUsd: montoUsd,
        fechaPago: pPago.toISOString(),
        fechaVencimiento: pVencimiento.toISOString(),
        diasPlan: 30,
        metodoPago: isMobile ? 'pagoMovil' : 'efectivo',
        banco: isMobile ? randomItem(banks) : null,
        referencia: isMobile ? `${Math.floor(Math.random() * 9000) + 1000}` : null,
        concepto: pPago.getTime() === currDate.getTime() ? 'inscripcion' : 'mensualidad',
        notas: '',
        createdAt: pPago.toISOString()
      };
      
      payments.push(payment);
      pVencimiento = pPago;
    }
  }
}

const exportData = {
  version: 1,
  exportDate: new Date().toISOString(),
  app: 'GymPay',
  data: {
    members: members,
    payments: payments,
    settings: [
      { key: 'nombreGym', value: 'GymPay Demo' },
      { key: 'precioMensual', value: 720 },
      { key: 'tasaManual', value: 0 },
      { key: 'mensajeWhatsApp', value: 'Hola {nombre}! 👋 Te recordamos que tu mensualidad en {gym} vence el {fecha}. ¡Te esperamos para renovar! 💪🏋️' }
    ]
  }
};

fs.writeFileSync('mock_data.json', JSON.stringify(exportData, null, 2));
console.log(`Generated mock_data.json with ${members.length} members and ${payments.length} payments.`);
