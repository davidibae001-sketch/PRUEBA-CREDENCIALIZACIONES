import { MedicalCredential, SystemUser, DirectoryPhysician, GuardShift, Sanction, BlacklistPhysician } from '../types';

/**
 * Robust Client API Bridge - Synchronizes Live PostgreSQL Server and Local Cache Fallbacks
 * Hospital San José de Sonora
 */

export function safeSetLocalStorage(key: string, data: any) {
  try {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    localStorage.setItem(key, raw);
  } catch (e) {
    console.warn(`[localStorage] Quota exceeded for key "${key}". Stripping heavy binary/base64 payloads...`);
    try {
      const sanitizeDeep = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'string') {
          if (obj.startsWith('data:') || (obj.length > 3000 && !obj.includes(' '))) {
            return undefined; // Strip large base64/data URLs
          }
          return obj;
        }
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
          return obj.map(sanitizeDeep).filter(item => item !== undefined);
        }
        const cleaned: Record<string, any> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k === 'file' || k === 'previewUrl' || k === 'content' || k === 'base64') continue;
          if (typeof v === 'string' && (v.startsWith('data:') || (v.length > 3000 && !v.includes(' ')))) {
            continue;
          }
          cleaned[k] = sanitizeDeep(v);
        }
        return cleaned;
      };

      const sanitized = sanitizeDeep(data);
      localStorage.setItem(key, JSON.stringify(sanitized));
    } catch (innerErr) {
      console.warn(`[localStorage] Storage quota still tight for "${key}". Cleaning old draft keys...`);
      try {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('cred_sj_reg_')) {
            localStorage.removeItem(k);
          }
        });
        const sanitizeDeepLight = (obj: any): any => {
          if (!obj || typeof obj !== 'object') {
            if (typeof obj === 'string' && (obj.startsWith('data:') || obj.length > 2000)) return undefined;
            return obj;
          }
          if (Array.isArray(obj)) return obj.map(sanitizeDeepLight);
          const c: Record<string, any> = {};
          for (const [k, v] of Object.entries(obj)) {
            if (k === 'file' || k === 'previewUrl' || k === 'portraitUrl' || k === 'signatureUrl' || k === 'base64' || k === 'content') continue;
            c[k] = sanitizeDeepLight(v);
          }
          return c;
        };
        localStorage.setItem(key, JSON.stringify(sanitizeDeepLight(data)));
      } catch (finalErr) {
        console.warn(`[localStorage] Suppressed QuotaExceededError for "${key}". Operating safely with live DB and memory state.`);
      }
    }
  }
}

// Simple check if server API is reachable
async function fetchWithFallback<T>(url: string, cacheKey: string, defaultData: T, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, options);
    if (res.ok) {
      const data = await res.json();
      // Sync into localStorage cache safely
      safeSetLocalStorage(cacheKey, data);
      return data;
    }
    throw new Error(`Server returned status ${res.status}`);
  } catch (err) {
    console.warn(`[API Connection Status] Offline or server unreachable on ${url}. Reading cache:`, err);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch (e) {
        console.error(`Failed to parse cache for ${cacheKey}`, e);
      }
    }
    return defaultData;
  }
}

export async function fetchServerStatus() {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  return { online: false, database: { connected: false, engine: 'Local Browser (Local Storage)' } };
}

// 1. CREDENTIALS API
export async function getCredentials(): Promise<MedicalCredential[]> {
  const cached = localStorage.getItem('credsj_credentials');
  const defaults = cached ? JSON.parse(cached) : [];
  return fetchWithFallback<MedicalCredential[]>('/api/credentials', 'credsj_credentials', defaults);
}

export async function saveCredential(cred: MedicalCredential): Promise<any> {
  // Always update local storage immediately
  const cached = localStorage.getItem('credsj_credentials');
  let list: MedicalCredential[] = cached ? JSON.parse(cached) : [];
  const idx = list.findIndex(c => String(c.id) === String(cred.id) || (c.folio && cred.folio && c.folio === cred.folio));
  if (idx >= 0) {
    list[idx] = cred;
  } else {
    list.unshift(cred);
  }
  safeSetLocalStorage('credsj_credentials', list);

  // Sync to database if server is reachable
  try {
    const res = await fetch('/api/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cred)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.credential) {
        const serverCred = data.credential;
        const freshIdx = list.findIndex(c => String(c.id) === String(cred.id) || String(c.id) === String(serverCred.id));
        if (freshIdx >= 0) {
          list[freshIdx] = serverCred;
        } else {
          list.unshift(serverCred);
        }
        safeSetLocalStorage('credsj_credentials', list);
        return serverCred;
      }
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not persist credentials to server, updating local cache only.", e);
  }

  return true;
}

export async function deleteCredential(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/credentials/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const cached = localStorage.getItem('credsj_credentials');
      if (cached) {
        let list: MedicalCredential[] = JSON.parse(cached);
        list = list.filter(c => c.id !== id);
        safeSetLocalStorage('credsj_credentials', list);
      }
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not delete credential on server.", e);
  }
  
  const cached = localStorage.getItem('credsj_credentials');
  if (cached) {
    let list: MedicalCredential[] = JSON.parse(cached);
    list = list.filter(c => c.id !== id);
    safeSetLocalStorage('credsj_credentials', list);
  }
  return true;
}

export async function purgeAllCredentials(): Promise<boolean> {
  try {
    const res = await fetch('/api/purge-all-credentials', { method: 'POST' });
    if (res.ok) {
      localStorage.removeItem('credsj_credentials');
      localStorage.removeItem('cred_sj_reg_data_guest');
      localStorage.removeItem('cred_sj_reg_files_guest');
      return true;
    }
  } catch (e) {
    console.error("Error purging credentials:", e);
  }
  localStorage.removeItem('credsj_credentials');
  return false;
}


// 2. SYSTEM USERS API
export async function getUsers(): Promise<SystemUser[]> {
  const cached = localStorage.getItem('credsj_users');
  const defaults = cached ? JSON.parse(cached) : [];
  return fetchWithFallback<SystemUser[]>('/api/users', 'credsj_users', defaults);
}

export async function saveUser(user: SystemUser): Promise<boolean> {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (res.ok) {
      await getUsers();
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not persist user to server.", e);
  }

  const cached = localStorage.getItem('credsj_users');
  let list: SystemUser[] = cached ? JSON.parse(cached) : [];
  const idx = list.findIndex(u => u.id === user.id);
  if (idx >= 0) {
    list[idx] = user;
  } else {
    list.push(user);
  }
  safeSetLocalStorage('credsj_users', list);
  return true;
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await getUsers();
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not delete user on server.", e);
  }

  const cached = localStorage.getItem('credsj_users');
  if (cached) {
    let list: SystemUser[] = JSON.parse(cached);
    list = list.filter(u => u.id !== id);
    safeSetLocalStorage('credsj_users', list);
  }
  return true;
}


// 3. PHYSICIANS DIRECTORY API
export async function getDirectory(): Promise<DirectoryPhysician[]> {
  const cached = localStorage.getItem('credsj_directory');
  const defaults = cached ? JSON.parse(cached) : [];
  return fetchWithFallback<DirectoryPhysician[]>('/api/directory', 'credsj_directory', defaults);
}

export async function saveDirectory(item: DirectoryPhysician): Promise<boolean> {
  try {
    const res = await fetch('/api/directory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (res.ok) {
      await getDirectory();
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not persist directory contact to server.", e);
  }

  const cached = localStorage.getItem('credsj_directory');
  let list: DirectoryPhysician[] = cached ? JSON.parse(cached) : [];
  const idx = list.findIndex(d => d.id === item.id);
  if (idx >= 0) {
    list[idx] = item;
  } else {
    list.push(item);
  }
  safeSetLocalStorage('credsj_directory', list);
  return true;
}

export async function bulkSaveDirectory(items: DirectoryPhysician[]): Promise<boolean> {
  try {
    const res = await fetch('/api/directory/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    if (res.ok) {
      await getDirectory();
      return true;
    }
  } catch (e) {
    console.warn("[API] Bulk save directory fallback:", e);
  }

  const cached = localStorage.getItem('credsj_directory');
  let list: DirectoryPhysician[] = cached ? JSON.parse(cached) : [];
  for (const item of items) {
    const idx = list.findIndex(d => d.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
  }
  safeSetLocalStorage('credsj_directory', list);
  return true;
}

export async function deleteDirectory(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/directory/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await getDirectory();
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not delete directory entry on server.", e);
  }

  const cached = localStorage.getItem('credsj_directory');
  if (cached) {
    let list: DirectoryPhysician[] = JSON.parse(cached);
    list = list.filter(d => d.id !== id);
    safeSetLocalStorage('credsj_directory', list);
  }
  return true;
}


// 4. GUARD SHIFTS API
export async function getGuards(): Promise<GuardShift[]> {
  const cached = localStorage.getItem('credsj_guard_shifts');
  const defaults = cached ? JSON.parse(cached) : [];
  return fetchWithFallback<GuardShift[]>('/api/guards', 'credsj_guard_shifts', defaults);
}

export async function saveGuard(shift: GuardShift): Promise<boolean> {
  try {
    const res = await fetch('/api/guards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shift)
    });
    if (res.ok) {
      await getGuards();
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not persist guard shift to server.", e);
  }

  const cached = localStorage.getItem('credsj_guard_shifts');
  let list: GuardShift[] = cached ? JSON.parse(cached) : [];
  const idx = list.findIndex(g => g.id === shift.id);
  if (idx >= 0) {
    list[idx] = shift;
  } else {
    list.push(shift);
  }
  safeSetLocalStorage('credsj_guard_shifts', list);
  return true;
}

export async function deleteGuard(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/guards/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await getGuards();
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not delete guard shift on server.", e);
  }

  const cached = localStorage.getItem('credsj_guard_shifts');
  if (cached) {
    let list: GuardShift[] = JSON.parse(cached);
    list = list.filter(g => g.id !== id);
    safeSetLocalStorage('credsj_guard_shifts', list);
  }
  return true;
}

// 5. SANCIONES API
export async function getSanctions(): Promise<Sanction[]> {
  const cached = localStorage.getItem('credsj_sanctions');
  const defaults = cached ? JSON.parse(cached) : [];
  return fetchWithFallback<Sanction[]>('/api/sanciones', 'credsj_sanctions', defaults);
}

export async function saveSanction(sanction: Sanction, pdfBase64?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/sanciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sanction, pdfBase64 })
    });
    if (res.ok) {
      await getSanctions();
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not persist sanction to server.", e);
  }

  const cached = localStorage.getItem('credsj_sanctions');
  let list: Sanction[] = cached ? JSON.parse(cached) : [];
  const idx = list.findIndex(s => s.id === sanction.id);
  if (idx >= 0) {
    list[idx] = sanction;
  } else {
    list.push(sanction);
  }
  safeSetLocalStorage('credsj_sanctions', list);
  return true;
}

export async function deleteSanction(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/sanciones/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await getSanctions();
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not delete sanction from server.", e);
  }

  const cached = localStorage.getItem('credsj_sanctions');
  if (cached) {
    let list: Sanction[] = JSON.parse(cached);
    list = list.filter(s => s.id !== id);
    safeSetLocalStorage('credsj_sanctions', list);
  }
  return true;
}

// 6. BLACKLIST / LISTA NEGRA API
export async function getBlacklist(): Promise<BlacklistPhysician[]> {
  const cached = localStorage.getItem('credsj_blacklist');
  const defaults = cached ? JSON.parse(cached) : [];
  return fetchWithFallback<BlacklistPhysician[]>('/api/blacklist', 'credsj_blacklist', defaults);
}

export async function saveBlacklistPhysician(item: BlacklistPhysician): Promise<boolean> {
  try {
    const res = await fetch('/api/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (res.ok) {
      await getBlacklist();
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not persist blacklist item to server.", e);
  }

  const cached = localStorage.getItem('credsj_blacklist');
  let list: BlacklistPhysician[] = cached ? JSON.parse(cached) : [];
  const idx = list.findIndex(b => b.id === item.id);
  if (idx >= 0) {
    list[idx] = item;
  } else {
    list.unshift(item);
  }
  safeSetLocalStorage('credsj_blacklist', list);
  return true;
}

export async function deleteBlacklistPhysician(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/blacklist/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await getBlacklist();
      return true;
    }
  } catch (e) {
    console.warn("[API] Could not delete blacklist item from server.", e);
  }

  const cached = localStorage.getItem('credsj_blacklist');
  if (cached) {
    let list: BlacklistPhysician[] = JSON.parse(cached);
    list = list.filter(b => b.id !== id);
    safeSetLocalStorage('credsj_blacklist', list);
  }
  return true;
}

