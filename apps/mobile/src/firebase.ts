import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence, indexedDBLocalPersistence, initializeAuth,
  onAuthStateChanged, signInWithEmailAndPassword, signOut, type User,
} from 'firebase/auth';
import { get, getDatabase, limitToLast, orderByKey, query, ref, set } from 'firebase/database';
import type { TransakceLehka, TransakceWeb } from '@ff/core';

/**
 * Stejný Firebase projekt jako financeflow.cz – stejný účet, stejná data.
 * Tyto údaje nejsou tajné (jsou i ve webové appce), přístup hlídají pravidla databáze.
 */
const app = initializeApp({
  apiKey: 'AIzaSyDtEdQw4WccmEzxXzMwPQlenqfnjoiVw4A',
  authDomain: 'financeflow-a249c.firebaseapp.com',
  databaseURL: 'https://financeflow-a249c-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'financeflow-a249c',
  storageBucket: 'financeflow-a249c.firebasestorage.app',
  messagingSenderId: '399807761148',
  appId: '1:399807761148:web:a20b1d9ae78aec23e7a579',
});

// initializeAuth místo getAuth: v Capacitoru getAuth čeká na iframe pro přihlášení
// přes okno, který ve WebView nefunguje.
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
const db = getDatabase(app);

export function sledujUzivatele(cb: (u: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function prihlasit(email: string, heslo: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), heslo);
}

export async function odhlasit(): Promise<void> {
  await signOut(auth);
}

const cesta = (uid: string, podcesta: string) => `users/${uid}/data/${podcesta}`;

export interface Penezenka { id: string; name: string }
export interface Kategorie { id: string; name: string; icon?: string }

function pole<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v.filter(Boolean) as T[];
  if (v && typeof v === 'object') return Object.values(v).filter(Boolean) as T[];
  return [];
}

export async function nactiPenezenky(uid: string): Promise<Penezenka[]> {
  const s = await get(ref(db, cesta(uid, 'wallets')));
  return pole<Penezenka>(s.val()).filter(w => w && w.id != null).map(w => ({ id: String(w.id), name: String(w.name ?? w.id) }));
}

export async function nactiKategorie(uid: string): Promise<Kategorie[]> {
  const s = await get(ref(db, cesta(uid, 'categories')));
  return pole<Kategorie>(s.val()).filter(c => c && c.id != null);
}

/** Posledních N transakcí (podle id = podle času vzniku) kvůli kontrole duplicit. */
export async function nactiPosledniTransakce(uid: string, pocet = 300): Promise<TransakceLehka[]> {
  const s = await get(query(ref(db, cesta(uid, 'transactions')), orderByKey(), limitToLast(pocet)));
  return pole<TransakceLehka>(s.val());
}

/**
 * Zápis JEDNÉ transakce na její vlastní cestu. Nikdy nepřepisuje celé `data`
 * (web ukládá ostatní sekce jako celky a přepsal by si je navzájem s telefonem).
 * Web novou transakci přijme přes onChildAdded a hned ji ukáže.
 */
export async function zapisTransakci(uid: string, tx: TransakceWeb): Promise<void> {
  await set(ref(db, cesta(uid, `transactions/${tx.id}`)), tx);
}
