import { supabase } from '../services/supabase.js';

let _memberCountCache = null;
let _memberCountCacheTime = 0;
let _newMembersCache = new Map();
let _newMembersCacheTime = 0;
const CACHE_TTL = 60_000;

export function invalidateMembersCache() {
  _memberCountCache = null;
  _memberCountCacheTime = 0;
  _newMembersCache.clear();
}

/**
 * Add a new member to the database.
 * @param {Object} data
 * @returns {Promise<number>} The new member's ID
 */
export async function addMember(data) {
  const now = new Date().toISOString();
  
  if (data.cedula) {
    const { data: existing } = await supabase.from('members').select('id').eq('cedula', data.cedula).maybeSingle();
    if (existing) {
      throw new Error(`Ya existe un miembro con la cédula "${data.cedula}".`);
    }
  }

  const member = {
    nombre: data.nombre || '',
    apellido: data.apellido || '',
    cedula: data.cedula || null,
    edad: data.edad || null,
    telefono: data.telefono || '',
    correo: data.correo || null,
    fechaInscripcion: data.fechaInscripcion || now,
    estado: 'activo',
    notas: data.notas || '',
    createdAt: now,
  };

  const { data: result, error } = await supabase.from('members').insert(member).select('id').single();
  if (error) {
    console.error('Error adding member:', error);
    throw error;
  }
  invalidateMembersCache();
  return result.id;
}

/**
 * Update an existing member.
 */
export async function updateMember(id, data) {
  if (data.cedula) {
    const { data: existing } = await supabase.from('members').select('id').eq('cedula', data.cedula).neq('id', id).maybeSingle();
    if (existing) {
      throw new Error(`Ya existe un miembro con la cédula "${data.cedula}".`);
    }
  }

  const { data: result, error } = await supabase.from('members').update(data).eq('id', id).select().single();
  if (error) {
    console.error('Error updating member:', error);
    throw error;
  }
  invalidateMembersCache();
  return result;
}

/**
 * Toggle active/inactive status.
 */
export async function toggleMemberStatus(id) {
  const { data: member, error: fetchErr } = await supabase.from('members').select('estado').eq('id', id).single();
  if (fetchErr) throw fetchErr;

  const newStatus = member.estado === 'activo' ? 'inactivo' : 'activo';
  const { data: updated, error } = await supabase.from('members').update({ estado: newStatus }).eq('id', id).select().single();
  if (error) throw error;
  
  invalidateMembersCache();
  return updated;
}

/**
 * Get a single member by ID.
 */
export async function getMember(id) {
  const { data, error } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('Error fetching member:', error);
    return undefined;
  }
  return data;
}

/**
 * Get all members, optionally filtered.
 * Uses server-side filtering for performance with large datasets.
 */
export async function getAllMembers(filters = {}) {
  let query = supabase.from('members').select('*');

  if (filters.estado) {
    query = query.eq('estado', filters.estado);
  }

  // Use Supabase server-side search for performance with large datasets
  if (filters.search) {
    const q = filters.search.trim();
    query = query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,cedula.ilike.%${q}%`);
  }

  const { data, error } = await query.order('nombre', { ascending: true });
  if (error) {
    console.error('Error fetching members:', error);
    return [];
  }

  return data || [];
}

/**
 * Search members by name or cedula (server-side for performance).
 */
export async function searchMembers(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim();
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,cedula.ilike.%${q}%`)
    .order('nombre', { ascending: true })
    .limit(20);
  
  if (error) {
    console.error('Error searching members:', error);
    return [];
  }
  return data || [];
}

/**
 * Get count of active members.
 */
export async function getMemberCount() {
  const now = Date.now();
  if (_memberCountCache !== null && now - _memberCountCacheTime < CACHE_TTL) return _memberCountCache;

  const { count, error } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('estado', 'activo');
  if (error) {
    console.error('Error counting members:', error);
    return 0;
  }
  
  _memberCountCache = count;
  _memberCountCacheTime = now;
  return count;
}

/**
 * Get count of new members in a date range.
 */
export async function getNewMembersCount(startDate, endDate) {
  const cacheKey = `${startDate}_${endDate}`;
  const now = Date.now();
  if (now - _newMembersCacheTime > CACHE_TTL) {
    _newMembersCache.clear();
    _newMembersCacheTime = now;
  }
  if (_newMembersCache.has(cacheKey)) return _newMembersCache.get(cacheKey);

  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .gte('fechaInscripcion', startDate)
    .lte('fechaInscripcion', endDate);
    
  if (error) {
    console.error('Error counting new members:', error);
    return 0;
  }
  
  _newMembersCache.set(cacheKey, count);
  return count;
}
