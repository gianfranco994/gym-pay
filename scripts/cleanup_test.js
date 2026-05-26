import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhcymugxtimtqtsukxxx.supabase.co';
const supabaseKey = 'sb_publishable_lss5nBc9gmpm1VE7vCYQxg_kJSO_GQ-';
const supabase = createClient(supabaseUrl, supabaseKey);

const EMAIL = process.env.GYM_EMAIL || 'ciaat2026@gmail.com';
const PASSWORD = process.env.GYM_PASS || 'Ciaat2026**';

const MOCK_FLAG = '[STRESS_TEST]';

async function run() {
  console.log('🧹 Iniciando limpieza de datos de prueba...');
  const startTime = Date.now();

  // 1. Authenticate
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authErr) {
    console.error('❌ Error de autenticación:', authErr.message);
    return;
  }
  console.log('✅ Autenticado como Administrador');

  // 2. Borrar pagos de prueba
  console.log('Eliminando pagos de prueba...');
  const { error: payErr } = await supabase.from('payments').delete().eq('notas', MOCK_FLAG);
  if (payErr) {
    console.error('❌ Error eliminando pagos:', payErr.message);
  } else {
    console.log('✅ Pagos de prueba eliminados.');
  }

  // 3. Borrar miembros de prueba
  console.log('Eliminando miembros de prueba...');
  const { error: memErr } = await supabase.from('members').delete().eq('notas', MOCK_FLAG);
  if (memErr) {
    console.error('❌ Error eliminando miembros:', memErr.message);
  } else {
    console.log('✅ Miembros de prueba eliminados.');
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 LIMPIEZA COMPLETADA EN ${totalTime} SEGUNDOS!`);
  console.log('Tu base de datos ha vuelto a la normalidad.');
}

run();
