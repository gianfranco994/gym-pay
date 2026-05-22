import { supabase } from '../services/supabase.js';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(days) {
  const d = startOfToday();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function getMembersWithLatestPayment() {
  // Fetch all members
  const { data: members, error: memErr } = await supabase.from('members').select('*');
  if (memErr) throw memErr;

  // We could fetch only latest payments, but since dataset is small we can just get all payments
  // and sort them out. We only care about approved payments for membership status.
  const { data: allPayments, error: payErr } = await supabase.from('payments').select('*').eq('estado_pago', 'aprobado');
  if (payErr) throw payErr;

  const latestMap = new Map();
  for (const p of allPayments) {
    const current = latestMap.get(p.memberId);
    if (!current || new Date(p.fechaPago) > new Date(current.fechaPago)) {
      latestMap.set(p.memberId, p);
    }
  }

  return (members || [])
    .filter((m) => latestMap.has(m.id))
    .map((m) => ({ member: m, payment: latestMap.get(m.id) }));
}

export async function addPayment(data) {
  const now = new Date().toISOString();

  const payment = {
    memberId: data.memberId,
    montoBs: data.montoBs ?? 0,
    tasaUsd: data.tasaUsd ?? 0,
    montoUsd: data.montoUsd ?? 0,
    fechaPago: data.fechaPago ?? now,
    fechaVencimiento: data.fechaVencimiento ?? now,
    diasPlan: data.diasPlan ?? 30,
    metodoPago: data.metodoPago ?? 'efectivo',
    banco: data.banco ?? null,
    referencia: data.referencia ?? null,
    concepto: data.concepto ?? 'mensualidad',
    estado_pago: data.estado_pago ?? 'aprobado',
    notas: data.notas ?? '',
    createdAt: now,
  };

  const { data: member, error: memCheck } = await supabase.from('members').select('id').eq('id', payment.memberId).single();
  if (memCheck || !member) {
    throw new Error(`Miembro con id ${payment.memberId} no encontrado.`);
  }

  const { data: result, error: payErr } = await supabase.from('payments').insert(payment).select('id').single();
  if (payErr) throw payErr;

  if (payment.estado_pago === 'aprobado') {
    const { error: updErr } = await supabase.from('members').update({ estado: 'activo' }).eq('id', payment.memberId);
    if (updErr) throw updErr;
  }

  return result.id;
}

export async function getPaymentsByMember(memberId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('memberId', memberId)
    .order('fechaPago', { ascending: false });

  if (error) {
    console.error('Error fetching payments:', error);
    return [];
  }
  return data;
}

export async function getLatestPayment(memberId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('memberId', memberId)
    .eq('estado_pago', 'aprobado')
    .order('fechaPago', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function getPaymentsByDateRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('payments')
    .select('*, members(nombre, apellido, cedula)')
    .gte('fechaPago', startDate)
    .lte('fechaPago', endDate)
    .eq('estado_pago', 'aprobado')
    .order('fechaPago', { ascending: false });

  if (error) return [];
  return data;
}

export async function getExpiringMembers(days) {
  try {
    const pairs = await getMembersWithLatestPayment();
    const today = startOfToday();
    const limit = addDays(days);

    return pairs.filter(({ payment }) => {
      const venc = new Date(payment.fechaVencimiento);
      return venc >= today && venc <= limit;
    });
  } catch (error) {
    console.error('Error getting expiring members:', error);
    return [];
  }
}

export async function getExpiredMembers() {
  try {
    const pairs = await getMembersWithLatestPayment();
    const today = startOfToday();

    return pairs.filter(({ payment }) => {
      const venc = new Date(payment.fechaVencimiento);
      return venc < today;
    });
  } catch (error) {
    return [];
  }
}

export async function getActiveMembers() {
  try {
    const pairs = await getMembersWithLatestPayment();
    const today = startOfToday();

    return pairs.filter(({ payment }) => {
      const venc = new Date(payment.fechaVencimiento);
      return venc >= today;
    });
  } catch (error) {
    return [];
  }
}

export async function getMonthlyAnalytics(month, year) {
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
  return await computeAnalytics(startDate, endDate);
}

export async function getCustomAnalytics(startDate, endDate) {
  return await computeAnalytics(startDate, endDate);
}

export async function getAllPayments() {
  const { data, error } = await supabase.from('payments').select('*').eq('estado_pago', 'aprobado').order('fechaPago', { ascending: false });
  if (error) return [];
  return data;
}

export async function getPayment(paymentId) {
  const { data, error } = await supabase.from('payments').select('*, members(nombre, apellido, cedula)').eq('id', paymentId).single();
  if (error) return null;
  return data;
}

export async function getPendingPayments() {
  const { data, error } = await supabase.from('payments').select('*, members(nombre, apellido, cedula)').eq('estado_pago', 'pendiente').order('createdAt', { ascending: false });
  if (error) return [];
  return data;
}

export async function approvePayment(paymentId) {
  const { data: pay, error: payErr } = await supabase.from('payments').update({ estado_pago: 'aprobado' }).eq('id', paymentId).select('memberId').single();
  if (payErr) throw payErr;
  if (pay && pay.memberId) {
    await supabase.from('members').update({ estado: 'activo' }).eq('id', pay.memberId);
  }
}

export async function rejectPayment(paymentId) {
  const { error } = await supabase.from('payments').update({ estado_pago: 'rechazado' }).eq('id', paymentId);
  if (error) throw error;
}

async function computeAnalytics(startDate, endDate) {
  const payments = await getPaymentsByDateRange(startDate, endDate);
  
  let totalBs = 0;
  let totalUsd = 0;
  let newMembers = 0;
  let renewals = 0;

  const byMethod = {
    pagoMovil: { count: 0, total: 0 },
    efectivo: { count: 0, total: 0 },
  };

  const { data: allMembers, error } = await supabase.from('members').select('id, fechaInscripcion');
  const memberCache = new Map();
  if (!error && allMembers) {
    allMembers.forEach(m => memberCache.set(m.id, m));
  }

  for (const p of payments) {
    totalBs += p.montoBs ?? 0;
    totalUsd += p.montoUsd ?? 0;

    const method = p.metodoPago === 'pagoMovil' ? 'pagoMovil' : 'efectivo';
    byMethod[method].count += 1;
    byMethod[method].total += p.montoBs ?? 0;

    const member = memberCache.get(p.memberId);
    if (member) {
      const inscripcion = new Date(member.fechaInscripcion).getTime();
      const rangeStart = new Date(startDate).getTime();
      if (inscripcion >= rangeStart) {
        newMembers += 1;
      } else {
        renewals += 1;
      }
    }
  }

  return {
    totalBs,
    totalUsd,
    totalPayments: payments.length,
    newMembers,
    renewals,
    byMethod,
  };
}

function emptyAnalytics() {
  return {
    totalBs: 0,
    totalUsd: 0,
    totalPayments: 0,
    newMembers: 0,
    renewals: 0,
    byMethod: {
      pagoMovil: { count: 0, total: 0 },
      efectivo: { count: 0, total: 0 },
    },
  };
}
