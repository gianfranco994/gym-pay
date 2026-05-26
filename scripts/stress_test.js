import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhcymugxtimtqtsukxxx.supabase.co';
const supabaseKey = 'sb_publishable_lss5nBc9gmpm1VE7vCYQxg_kJSO_GQ-';
const supabase = createClient(supabaseUrl, supabaseKey);

const EMAIL = process.env.GYM_EMAIL || 'ciaat2026@gmail.com';
const PASSWORD = process.env.GYM_PASS || 'Ciaat2026**';

const MOCK_FLAG = '[STRESS_TEST]';
const TOTAL_MEMBERS = 500;
const PAYMENTS_PER_MEMBER = 3;

async function run() {
  console.log('🚀 Iniciando Prueba de Estrés...');
  const startTime = Date.now();

  // 1. Authenticate
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authErr) {
    console.error('❌ Error de autenticación:', authErr.message);
    return;
  }
  console.log('✅ Autenticado como Administrador');

  // 2. Generate Members
  console.log(`\n👨‍👩‍👧‍👦 Generando ${TOTAL_MEMBERS} clientes...`);
  const members = [];
  const now = new Date();
  
  for (let i = 0; i < TOTAL_MEMBERS; i++) {
    const insc = new Date(now.getTime() - Math.random() * 10000000000); // Random inscription date in the past
    members.push({
      nombre: `Tester_${i}`,
      apellido: `Bot_${Math.floor(Math.random() * 1000)}`,
      cedula: `V-99${String(i).padStart(6, '0')}`,
      edad: 18 + Math.floor(Math.random() * 40),
      telefono: `0412${String(Math.floor(Math.random() * 9999999)).padStart(7, '0')}`,
      estado: 'activo',
      notas: MOCK_FLAG,
      fechaInscripcion: insc.toISOString(),
      createdAt: new Date().toISOString()
    });
  }

  // Insert members in batches of 100 to avoid request too large errors
  const insertedMembers = [];
  for (let i = 0; i < members.length; i += 100) {
    const batch = members.slice(i, i + 100);
    const { data, error } = await supabase.from('members').insert(batch).select('id');
    if (error) {
      console.error(`❌ Error insertando lote de miembros ${i}:`, error.message);
      return;
    }
    insertedMembers.push(...data);
    console.log(`   - Lote insertado (${i + batch.length}/${TOTAL_MEMBERS})`);
  }
  
  console.log('✅ Miembros insertados exitosamente.');

  // 3. Generate Payments
  const totalPayments = insertedMembers.length * PAYMENTS_PER_MEMBER;
  console.log(`\n💳 Generando ${totalPayments} pagos históricos...`);
  const payments = [];

  for (const member of insertedMembers) {
    let currentVencimiento = new Date(now.getTime() - (PAYMENTS_PER_MEMBER * 30 * 24 * 60 * 60 * 1000));
    
    for (let p = 0; p < PAYMENTS_PER_MEMBER; p++) {
      const fechaPago = new Date(currentVencimiento);
      currentVencimiento.setDate(currentVencimiento.getDate() + 30);
      
      payments.push({
        memberId: member.id,
        montoBs: 1000 + Math.random() * 500,
        tasaUsd: 40,
        montoUsd: 25 + Math.random() * 10,
        fechaPago: fechaPago.toISOString(),
        fechaVencimiento: currentVencimiento.toISOString(),
        diasPlan: 30,
        metodoPago: Math.random() > 0.5 ? 'pagoMovil' : 'efectivo',
        banco: 'Banesco',
        referencia: String(Math.floor(1000 + Math.random() * 9000)),
        concepto: 'mensualidad',
        estado_pago: 'aprobado',
        notas: MOCK_FLAG,
        createdAt: fechaPago.toISOString()
      });
    }
  }

  // Insert payments in batches of 500
  for (let i = 0; i < payments.length; i += 500) {
    const batch = payments.slice(i, i + 500);
    const { error } = await supabase.from('payments').insert(batch);
    if (error) {
      console.error(`❌ Error insertando lote de pagos ${i}:`, error.message);
      return;
    }
    console.log(`   - Lote insertado (${i + batch.length}/${totalPayments})`);
  }

  console.log('✅ Pagos insertados exitosamente.');

  // 4. Simulate Client Portal Attack (Concurrent Requests)
  console.log('\n🔥 Simulando 50 peticiones simultáneas de clientes buscando su cédula (Ataque DDoS al Portal)...');
  const attackPromises = [];
  let successCount = 0;
  let failCount = 0;

  const attackStart = Date.now();
  for (let i = 0; i < 50; i++) {
    const randomCedula = `V-99${String(Math.floor(Math.random() * TOTAL_MEMBERS)).padStart(6, '0')}`;
    attackPromises.push(
      supabase.from('members').select('id, nombre, estado').eq('cedula', randomCedula).maybeSingle()
        .then(({ data, error }) => {
          if (error) failCount++;
          else successCount++;
        })
    );
  }

  await Promise.all(attackPromises);
  const attackTime = Date.now() - attackStart;

  console.log(`✅ Ataque completado en ${attackTime}ms`);
  console.log(`   - Exitosas: ${successCount}`);
  console.log(`   - Fallidas: ${failCount}`);

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 PRUEBA DE ESTRÉS COMPLETADA EN ${totalTime} SEGUNDOS!`);
  console.log('Ve a la interfaz de la aplicación e interactúa con el Dashboard y la página de Miembros para verificar el rendimiento en la UI.');
}

run();
