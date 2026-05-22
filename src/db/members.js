import { supabase } from '../services/supabase.js';

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
  return result.id;
}

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
  return result;
}

export async function toggleMemberStatus(id) {
  const { data: member, error: fetchErr } = await supabase.from('members').select('estado').eq('id', id).single();
  if (fetchErr) throw fetchErr;

  const newStatus = member.estado === 'activo' ? 'inactivo' : 'activo';
  const { data: updated, error } = await supabase.from('members').update({ estado: newStatus }).eq('id', id).select().single();
  if (error) throw error;
  
  return updated;
}

export async function getMember(id) {
  const { data, error } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('Error fetching member:', error);
    return undefined;
  }
  return data;
}

export async function getAllMembers(filters = {}) {
  let query = supabase.from('members').select('*');

  if (filters.estado) {
    query = query.eq('estado', filters.estado);
  }

  // Text search on the client side to avoid complex ilike with multiple columns,
  // or we could use Supabase OR filter. Let's fetch and filter locally since dataset is small (<1000).
  const { data, error } = await query.order('nombre', { ascending: true });
  if (error) {
    console.error('Error fetching members:', error);
    return [];
  }

  let members = data || [];
  
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    members = members.filter((m) => {
      const fullName = `${m.nombre} ${m.apellido}`.toLowerCase();
      const cedula = (m.cedula || '').toLowerCase();
      return fullName.includes(q) || cedula.includes(q);
    });
  }

  return members;
}

export async function searchMembers(query) {
  if (!query || !query.trim()) return [];
  const members = await getAllMembers();
  const q = query.toLowerCase().trim();
  
  return members.filter((m) => {
    const fullName = `${m.nombre} ${m.apellido}`.toLowerCase();
    const cedula = (m.cedula || '').toLowerCase();
    return fullName.includes(q) || cedula.includes(q);
  });
}

export async function getMemberCount() {
  const { count, error } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('estado', 'activo');
  if (error) {
    console.error('Error counting members:', error);
    return 0;
  }
  return count;
}

export async function getNewMembersCount(startDate, endDate) {
  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .gte('fechaInscripcion', startDate)
    .lte('fechaInscripcion', endDate);
    
  if (error) {
    console.error('Error counting new members:', error);
    return 0;
  }
  return count;
}
