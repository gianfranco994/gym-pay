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

/**
 * Fetch all members with their latest approved payment in two queries (not N+1).
 * @returns {Promise<Array<{member, payment}>>}
 */
async function getMembersWithLatestPayment() {
  // Single query for all members
  const { data: members, error: memErr } = await supabase.from('members').select('*');
  if (memErr) throw memErr;

  // Single query for all approved payments — only fetch fields we need
  const { data: allPayments, error: payErr } = await supabase
    .from('payments')
    .select('id, memberId, fechaPago, fechaVencimiento, montoBs, montoUsd, metodoPago')
    .eq('estado_pago', 'aprobado');
  if (payErr) throw payErr;

  // Build a map of memberId -> latest payment in O(n) instead of N queries
  const latestMap = new Map();
  for (const p of (allPayments || [])) {
    const current = latestMap.get(p.memberId);
    if (!current || new Date(p.fechaPago) > new Date(current.fechaPago)) {
      latestMap.set(p.memberId, p);
    }
  }

  return (members || [])
    .filter((m) => latestMap.has(m.id))
    .map((m) => ({ member: m, payment: latestMap.get(m.id) }));
}

/**
 * Fetch all members with latest payment — cached per render cycle to avoid
 * duplicate calls from getExpiringMembers / getExpiredMembers / getActiveMembers.
 */
let _membersWithPaymentCache = null;
let _membersWithPaymentCacheTime = 0;
let _analyticsCache = new Map();
let _analyticsCacheTime = 0;
let _allPaymentsCache = null;
let _allPaymentsCacheTime = 0;
let _pendingPaymentsCache = null;
let _pendingPaymentsCacheTime = 0;

const CACHE_TTL = 60_000; // 1 minute

async function getMembersWithLatestPaymentCached() {
  const now = Date.now();
  if (_membersWithPaymentCache && now - _membersWithPaymentCacheTime < CACHE_TTL) {
    return _membersWithPaymentCache;
  }
  _membersWithPaymentCache = await getMembersWithLatestPayment();
  _membersWithPaymentCacheTime = now;
  return _membersWithPaymentCache;
}

/** Invalidate the cache (call after adding/approving payments) */
export function invalidateMemberPaymentCache() {
  _membersWithPaymentCache = null;
  _membersWithPaymentCacheTime = 0;
  _analyticsCache.clear();
  _allPaymentsCache = null;
  _allPaymentsCacheTime = 0;
  _pendingPaymentsCache = null;
  _pendingPaymentsCacheTime = 0;
}

/**
 * Add a new payment record.
 */
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

  // Invalidate cache so next load is fresh
  invalidateMemberPaymentCache();

  return result.id;
}

/**
 * Get all payments for a specific member.
 */
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

/**
 * Get the latest approved payment for a member.
 */
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

/**
 * Get approved payments in a date range with member info.
 */
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

/**
 * Get members whose membership expires within `days` days.
 */
export async function getExpiringMembers(days) {
  try {
    const pairs = await getMembersWithLatestPaymentCached();
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

/**
 * Get members whose membership has expired.
 */
export async function getExpiredMembers() {
  try {
    const pairs = await getMembersWithLatestPaymentCached();
    const today = startOfToday();

    return pairs.filter(({ payment }) => {
      const venc = new Date(payment.fechaVencimiento);
      return venc < today;
    });
  } catch (error) {
    return [];
  }
}

/**
 * Get members with active membership.
 */
export async function getActiveMembers() {
  try {
    const pairs = await getMembersWithLatestPaymentCached();
    const today = startOfToday();

    return pairs.filter(({ payment }) => {
      const venc = new Date(payment.fechaVencimiento);
      return venc >= today;
    });
  } catch (error) {
    return [];
  }
}

/**
 * Get analytics for a specific month.
 */
export async function getMonthlyAnalytics(month, year) {
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
  return await computeAnalytics(startDate, endDate);
}

/**
 * Get analytics for a custom date range.
 */
export async function getCustomAnalytics(startDate, endDate) {
  return await computeAnalytics(startDate, endDate);
}

/**
 * Get all recent approved payments (limited to 100 for performance).
 */
export async function getAllPayments() {
  const now = Date.now();
  if (_allPaymentsCache && now - _allPaymentsCacheTime < CACHE_TTL) return _allPaymentsCache;

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('estado_pago', 'aprobado')
    .order('fechaPago', { ascending: false })
    .limit(100); // Prevent downloading thousands of records
  if (error) return [];
  
  _allPaymentsCache = data;
  _allPaymentsCacheTime = now;
  return data;
}

/**
 * Get a single payment with member info.
 */
export async function getPayment(paymentId) {
  const { data, error } = await supabase.from('payments').select('*, members(nombre, apellido, cedula)').eq('id', paymentId).single();
  if (error) return null;
  return data;
}

/**
 * Get all pending payments (awaiting approval) with member info.
 */
export async function getPendingPayments() {
  const now = Date.now();
  if (_pendingPaymentsCache && now - _pendingPaymentsCacheTime < CACHE_TTL) return _pendingPaymentsCache;

  const { data, error } = await supabase
    .from('payments')
    .select('*, members(nombre, apellido, cedula)')
    .eq('estado_pago', 'pendiente')
    .order('createdAt', { ascending: false });
  if (error) return [];
  
  _pendingPaymentsCache = data;
  _pendingPaymentsCacheTime = now;
  return data;
}

/**
 * Check if a member already has a pending payment (prevents duplicates).
 * @param {number} memberId
 * @returns {Promise<boolean>}
 */
export async function hasPendingPayment(memberId) {
  const { data, error } = await supabase
    .from('payments')
    .select('id')
    .eq('memberId', memberId)
    .eq('estado_pago', 'pendiente')
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

/**
 * Approve a pending payment and update member status.
 */
export async function approvePayment(paymentId) {
  const { data: pay, error: payErr } = await supabase
    .from('payments')
    .update({ estado_pago: 'aprobado' })
    .eq('id', paymentId)
    .select('memberId, fechaVencimiento')
    .single();
  if (payErr) throw payErr;

  if (pay && pay.memberId) {
    await supabase.from('members').update({ estado: 'activo' }).eq('id', pay.memberId);
  }
  invalidateMemberPaymentCache();
}

/**
 * Reject a pending payment.
 */
export async function rejectPayment(paymentId) {
  const { error } = await supabase.from('payments').update({ estado_pago: 'rechazado' }).eq('id', paymentId);
  if (error) throw error;
}

/**
 * Compute analytics for a date range.
 */
async function computeAnalytics(startDate, endDate) {
  const cacheKey = `${startDate}_${endDate}`;
  const now = Date.now();
  
  if (now - _analyticsCacheTime > CACHE_TTL) {
    _analyticsCache.clear();
    _analyticsCacheTime = now;
  }
  if (_analyticsCache.has(cacheKey)) return _analyticsCache.get(cacheKey);

  const payments = await getPaymentsByDateRange(startDate, endDate);
  
  let totalBs = 0;
  let totalUsd = 0;
  let newMembers = 0;
  let renewals = 0;

  const byMethod = {
    pagoMovil: { count: 0, total: 0 },
    efectivo: { count: 0, total: 0 },
  };

  // Fetch member inscription dates in one query
  const memberIds = [...new Set(payments.map(p => p.memberId))];
  const memberCache = new Map();

  if (memberIds.length > 0) {
    const { data: allMembers, error } = await supabase
      .from('members')
      .select('id, fechaInscripcion')
      .in('id', memberIds);
    if (!error && allMembers) {
      allMembers.forEach(m => memberCache.set(m.id, m));
    }
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

  const result = {
    totalBs,
    totalUsd,
    totalPayments: payments.length,
    newMembers,
    renewals,
    byMethod,
  };
  
  _analyticsCache.set(cacheKey, result);
  return result;
}
