"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint, // Importamos QueryConstraint para un tipado correcto
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import {format} from "date-fns/format";

// Definimos los tipos de datos para las colecciones de Firestore
type ExtraDose = {
  id: string;
  studentId: string;
  studentNameSnapshot: string;
  medicationName: string;
  dosage: string;
  date: string;
  timeRange: string;
  status: string;
  notes?: string;
  createdAt?: DocumentData;
};

type AdminRec = {
  id: string;
  studentId: string;
  studentFullNameSortable: string;
  medId?: string | null;
  date: string;
  timeRange: string;
  status: string;
  givenByUid?: string;
  dosage?: string;
  createdAt?: DocumentData;
};

export default function DayView() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState<string>(today);
  const [timeRange, setTimeRange] = useState<string>("ALMUERZO");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "GIVEN" | "NO_SHOW">(
    "ALL"
  );

  const [extraDoses, setExtraDoses] = useState<ExtraDose[]>([]);
  const [administrations, setAdministrations] = useState<AdminRec[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, timeRange, statusFilter]);

  // Función genérica para mapear un documento de Firestore a un tipo específico
  const mapDocToType = <T,>(doc: QueryDocumentSnapshot<DocumentData, DocumentData>): T => {
    return { id: doc.id, ...doc.data() } as T;
  };

  async function fetchAll() {
    setLoading(true);
    setMsg(null);
    try {
      // 1) extraDoses query
      const extraQConstraints: QueryConstraint[] = [
        where("date", "==", date),
        where("timeRange", "==", timeRange),
      ];
      if (statusFilter !== "ALL") {
        extraQConstraints.push(where("status", "==", statusFilter));
      }
      const extraQ = query(collection(db, "extraDoses"), ...extraQConstraints);
      const extraSnap = await getDocs(extraQ);
      const extras: ExtraDose[] = extraSnap.docs.map(doc => mapDocToType<ExtraDose>(doc));

      // 2) administrations query
      const adminQConstraints: QueryConstraint[] = [
        where("date", "==", date),
        where("timeRange", "==", timeRange),
      ];
      if (statusFilter !== "ALL") {
        adminQConstraints.push(where("status", "==", statusFilter));
      }
      const adminQ = query(collection(db, "administrations"), ...adminQConstraints);
      const adminSnap = await getDocs(adminQ);
      const admins: AdminRec[] = adminSnap.docs.map(doc => mapDocToType<AdminRec>(doc));

      setExtraDoses(extras);
      setAdministrations(admins);
    } catch (err: unknown) {
      console.error("Fetch error:", err);
      setMsg("Error al leer datos. Revisa consola.");
    } finally {
      setLoading(false);
    }
  }

  // Crear una administración (marcar Given)
  async function createAdministrationFromExtra(extra: ExtraDose) {
    try {
      setMsg("Registrando administración...");
      await addDoc(collection(db, "administrations"), {
        studentId: extra.studentId,
        studentFullNameSortable: extra.studentNameSnapshot.trim(),
        medId: null,
        date: extra.date,
        timeRange: extra.timeRange,
        status: "GIVEN",
        givenByUid: (auth?.currentUser && auth.currentUser.uid) || "test-uid",
        createdAt: serverTimestamp(),
        dosage: extra.dosage,
      });
      setMsg("Administración guardada.");
      await fetchAll();
    } catch (err) {
      console.error(err);
      setMsg("Error al guardar administración.");
    }
  }

  // Crear administration manual (desde lista vacía)
  async function createAdministrationManual() {
    try {
      setMsg("Registrando administración manual...");
      await addDoc(collection(db, "administrations"), {
        studentId: "manual-student-id",
        studentFullNameSortable: "Apellido, Nombre",
        medId: null,
        date,
        timeRange,
        status: "GIVEN",
        givenByUid: (auth?.currentUser && auth.currentUser.uid) || "test-uid",
        createdAt: serverTimestamp(),
        dosage: "N/A",
      });
      setMsg("Administración manual guardada.");
      await fetchAll();
    } catch (err) {
      console.error(err);
      setMsg("Error al guardar administración manual.");
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Vista del día — Prueba</h1>

      <div className="flex gap-3 items-end mb-4">
        <div>
          <label className="block text-sm">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border p-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm">Rango de tiempo</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border p-2 rounded"
          >
            <option>AYUNO</option>
            <option>DESAYUNO</option>
            <option>ALMUERZO</option>
            <option>CENA</option>
            <option>SOS</option>
          </select>
        </div>

        <div>
          <label className="block text-sm">Filtro estado</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "GIVEN" | "NO_SHOW")}
            className="border p-2 rounded"
          >
            <option value="ALL">Todos</option>
            <option value="GIVEN">Given</option>
            <option value="NO_SHOW">No Show</option>
          </select>
        </div>

        <div>
          <button
            onClick={fetchAll}
            className="bg-blue-600 text-white px-4 py-2 rounded"
            aria-label="Refrescar"
          >
            Buscar
          </button>
        </div>

        <div>
          <button
            onClick={createAdministrationManual}
            className="bg-gray-200 px-3 py-2 rounded"
            title="Crear admin. manual (prueba)"
          >
            + admin manual
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 text-sm text-gray-700">{msg}</div>}
      {loading && <div className="mb-4">Cargando…</div>}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Extra Doses ({extraDoses.length})</h2>
          {extraDoses.length === 0 && <div className="text-sm text-gray-500">No hay extra doses para esa fecha/rango.</div>}
          <ul className="space-y-2">
            {extraDoses.map((ed) => (
              <li key={ed.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">{ed.studentNameSnapshot}</div>
                  <div className="text-sm">{ed.medicationName} — {ed.dosage}</div>
                  <div className="text-xs text-gray-500">Notas: {ed.notes || "—"}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-green-700">{ed.status}</div>
                  <button
                    onClick={() => createAdministrationFromExtra(ed)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Registrar Given
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Administrations ({administrations.length})</h2>
          {administrations.length === 0 && <div className="text-sm text-gray-500">No hay administraciones registradas para esa fecha/rango.</div>}
          <ul className="space-y-2">
            {administrations.map((a) => (
              <li key={a.id} className="p-3 border rounded">
                <div className="font-medium">{a.studentFullNameSortable}</div>
                <div className="text-sm">{a.dosage || "—"} — {a.status}</div>
                <div className="text-xs text-gray-500">Dado por: {a.givenByUid || "—"}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}