"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as htmlToImage from "html-to-image";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Definimos los tipos para la base de datos para evitar 'any'
interface Student {
  id: string;
  firstName: string;
  firstSurname: string;
  secondSurname: string;
  active: boolean;
  createdAt: Timestamp | null;
}

interface Medication {
  id: string;
  studentId: string;
  medicationName: string;
  dosage: string;
  timeRanges: string[];
  notes: string;
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: Timestamp | null;
  hour?: string;
  medicationType?: "EXTRA" | "PERMANENT"; // Nueva propiedad
}

interface Administration {
  id: string;
  studentId: string;
  studentFullNameSortable: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  date: string;
  timeRange: string;
  status: "GIVEN" | "NOSHOW" | "PENDING";
  givenByUid: string;
  createdAt: Timestamp | null;
  hour?: string;
}

type MedicationForm = {
  id?: string;
  medicationName: string;
  dosage: string;
  timeRanges: string[];
  notes: string;
  startDate: string;
  endDate: string;
  hour?: string;
};

export default function MainPageClient() {
  const [students, setStudents] = useState<Student[]>([]);
  const [administrations, setAdministrations] = useState<Administration[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [dateFilter, setDateFilter] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>("AYUNO/DESAYUNO");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "GIVEN" | "NOSHOW">(
    "ALL"
  );
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showExtraMedForm, setShowExtraMedForm] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    firstSurname: "",
    secondSurname: "",
    medicationsToAdd: [] as MedicationForm[],
  });
  const [extraMedForm, setExtraMedForm] = useState({
    firstName: "",
    firstSurname: "",
    medicationName: "",
    dosage: "",
    timeRanges: [] as string[],
    notes: "",
    hour: "",
    date: dateFilter,
  });

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  
  // NUEVOS ESTADOS PARA MEDICAMENTOS SOS
  const [sosAdmins, setSosAdmins] = useState<Administration[]>([]);
  const [showSosModal, setShowSosModal] = useState(false);
  const [pdfDate, setPdfDate] = useState<string>('');


  // Nuevo: Referencia para el elemento que queremos exportar
  const studentListRef = useRef<HTMLDivElement>(null);

  const mapDocToTypedObject = <T,>(
    doc: QueryDocumentSnapshot<DocumentData, DocumentData>
  ) => ({
    id: doc.id,
    ...doc.data(),
  } as T);

  useEffect(() => {
    const q = query(collection(db, "students"), where("active", "==", true));
    return onSnapshot(q, (snapshot) => {
      setStudents(snapshot.docs.map((doc) => mapDocToTypedObject<Student>(doc)));
    });
  }, []);

  useEffect(() => {
    const rangesToQuery = timeRangeFilter === "AYUNO/DESAYUNO" ? ["AYUNO", "DESAYUNO"] : [timeRangeFilter];
    
    const q = query(
      collection(db, "administrations"),
      where("date", "==", dateFilter),
      where("timeRange", "in", rangesToQuery)
    );

    return onSnapshot(q, (snapshot) => {
      setAdministrations(
        snapshot.docs.map((doc) => mapDocToTypedObject<Administration>(doc))
      );
    });
  }, [dateFilter, timeRangeFilter]);

  useEffect(() => {
    const q = query(collection(db, "medications"));
    return onSnapshot(q, (snapshot) => {
      setMedications(
        snapshot.docs.map((doc) => mapDocToTypedObject<Medication>(doc))
      );
    });
  }, []);
  
  // NUEVO useEffect para buscar administraciones SOS
  useEffect(() => {
    if (showSosModal) {
      const q = query(
        collection(db, 'administrations'),
        where('timeRange', '==', 'SOS')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setSosAdmins(snapshot.docs.map(doc => mapDocToTypedObject<Administration>(doc)));
      });

      return () => unsubscribe();
    }
  }, [showSosModal]);

  const handleGiven = async (student: Student, med: Medication) => {
    try {
      const existingAdmin = administrations.find(a => 
        a.studentId === student.id && 
        a.medicationId === med.id && 
        a.date === dateFilter &&
        (timeRangeFilter === "AYUNO/DESAYUNO" ? ["AYUNO", "DESAYUNO"].includes(a.timeRange) : a.timeRange === timeRangeFilter)
      );

      if (existingAdmin && existingAdmin.status === "GIVEN") {
        console.warn("Administración ya registrada.");
        return;
      }
      
      const newTimeRange = timeRangeFilter === "AYUNO/DESAYUNO" ? med.timeRanges.find(tr => ["AYUNO", "DESAYUNO"].includes(tr)) : timeRangeFilter;

      await addDoc(collection(db, "administrations"), {
        studentId: student.id,
        studentFullNameSortable: `${student.firstSurname} ${student.secondSurname}, ${student.firstName}`,
        medicationId: med.id,
        medicationName: med.medicationName,
        dosage: med.dosage,
        date: dateFilter,
        timeRange: newTimeRange,
        status: "GIVEN",
        givenByUid: "test-uid",
        createdAt: serverTimestamp(),
        hour: med.hour || "",
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error al guardar administración:", err.message);
      } else {
        console.error(
          "Ocurrió un error inesperado al guardar la administración."
        );
      }
    }
  };

  const handleDeactivateStudent = async (studentId: string) => {
    try {
        const studentRef = doc(db, "students", studentId);
        await updateDoc(studentRef, {
            active: false,
        });
        console.log("Estudiante desactivado con éxito:", studentId);
    } catch (err) {
        console.error("Error al desactivar al estudiante:", err);
    }
  };

  const filteredStudents = students.filter((s) => {
    const medsForStudent = medications.filter(
      (m) =>
        m.studentId === s.id &&
        (timeRangeFilter === "AYUNO/DESAYUNO"
          ? m.timeRanges.some((tr) => ["AYUNO", "DESAYUNO"].includes(tr))
          : m.timeRanges.includes(timeRangeFilter)) &&
        dateFilter >= m.startDate &&
        dateFilter <= m.endDate
    );
    const wasGiven = administrations.some(
      (a) => a.studentId === s.id && a.status === "GIVEN"
    );

    if (statusFilter === "ALL") return medsForStudent.length > 0;
    if (statusFilter === "GIVEN") return wasGiven;
    if (statusFilter === "NOSHOW") return !wasGiven && medsForStudent.length > 0;
    return true;
  });

  const getMedicationsForStudent = (studentId: string) => {
    return medications.filter(
      (m) =>
        m.studentId === studentId &&
        (timeRangeFilter === "AYUNO/DESAYUNO"
          ? m.timeRanges.some((tr) => ["AYUNO", "DESAYUNO"].includes(tr))
          : m.timeRanges.includes(timeRangeFilter)) &&
        dateFilter >= m.startDate &&
        dateFilter <= m.endDate
    );
  };

  const addMedicationField = () => {
    setFormData({
      ...formData,
      medicationsToAdd: [
        ...formData.medicationsToAdd,
        {
          medicationName: "",
          dosage: "",
          timeRanges: [],
          notes: "",
          startDate: dateFilter,
          endDate: dateFilter,
        },
      ],
    });
  };

  const handleSaveStudent = async () => {
    try {
      const studentRef = await addDoc(collection(db, "students"), {
        firstName: formData.firstName,
        firstSurname: formData.firstSurname,
        secondSurname: formData.secondSurname,
        active: true,
        createdAt: serverTimestamp(),
      });

      for (const med of formData.medicationsToAdd) {
        await addDoc(collection(db, "medications"), {
          studentId: studentRef.id,
          medicationName: med.medicationName,
          dosage: med.dosage,
          timeRanges: med.timeRanges,
          notes: med.notes,
          startDate: med.startDate,
          endDate: med.endDate,
          active: true,
          createdAt: serverTimestamp(),
          medicationType: "PERMANENT",
        });
      }

      setShowForm(false);
      setFormData({
        firstName: "",
        firstSurname: "",
        secondSurname: "",
        medicationsToAdd: [],
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error al guardar estudiante/medicamentos:", err.message);
      } else {
        console.error(
          "Ocurrió un error inesperado al guardar estudiante/medicamentos."
        );
      }
    }
  };

  const handleSaveExtraMed = async () => {
    try {
      // Modificación clave: No busca al estudiante. Lo crea directamente.
      const studentRef = await addDoc(collection(db, "students"), {
        firstName: extraMedForm.firstName,
        firstSurname: extraMedForm.firstSurname,
        secondSurname: "", // No se solicita en el formulario, se deja vacío
        active: false, // Los estudiantes temporales se marcan como inactivos para no aparecer en la lista principal
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "medications"), {
        studentId: studentRef.id, // Asocia el medicamento al nuevo estudiante
        medicationName: extraMedForm.medicationName,
        dosage: extraMedForm.dosage,
        timeRanges: extraMedForm.timeRanges,
        notes: extraMedForm.notes,
        startDate: extraMedForm.date,
        endDate: extraMedForm.date,
        hour: extraMedForm.hour,
        active: true,
        createdAt: serverTimestamp(),
        medicationType: "EXTRA", // Nuevo campo para diferenciar el tipo de medicamento
      });

      setShowExtraMedForm(false);
      setExtraMedForm({
        firstName: "",
        firstSurname: "",
        medicationName: "",
        dosage: "",
        timeRanges: [],
        notes: "",
        hour: "",
        date: dateFilter,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error al guardar medicamento extra:", err.message);
      } else {
        console.error(
          "Ocurrió un error inesperado al guardar el medicamento extra."
        );
      }
    }
  };

  const handleEditStudent = (student: Student) => {
    const studentMeds = medications.filter((m) => m.studentId === student.id);
    setEditingStudentId(student.id);
    setFormData({
      firstName: student.firstName,
      firstSurname: student.firstSurname,
      secondSurname: student.secondSurname,
      medicationsToAdd: studentMeds,
    });
    setShowForm(true);
  };

  const handleUpdateStudent = async () => {
    if (!editingStudentId) return;

    try {
      const batch = writeBatch(db);

      const studentRef = doc(db, "students", editingStudentId);
      batch.update(studentRef, {
        firstName: formData.firstName,
        firstSurname: formData.firstSurname,
        secondSurname: formData.secondSurname,
      });

      const oldMeds = medications.filter((m) => m.studentId === editingStudentId);
      const newMeds = formData.medicationsToAdd;

      for (const oldMed of oldMeds) {
        if (!newMeds.some((newMed) => newMed.id === oldMed.id)) {
          batch.delete(doc(db, "medications", oldMed.id));
        }
      }

      for (const newMed of newMeds) {
        if (newMed.id) {
          const medRef = doc(db, "medications", newMed.id);
          batch.update(medRef, {
            medicationName: newMed.medicationName,
            dosage: newMed.dosage,
            timeRanges: newMed.timeRanges,
            notes: newMed.notes,
            startDate: newMed.startDate,
            endDate: newMed.endDate,
            hour: newMed.hour || "",
          });
        } else {
          const newMedRef = doc(collection(db, "medications"));
          batch.set(newMedRef, {
            studentId: editingStudentId,
            medicationName: newMed.medicationName,
            dosage: newMed.dosage,
            timeRanges: newMed.timeRanges,
            notes: newMed.notes,
            startDate: newMed.startDate,
            endDate: newMed.endDate,
            hour: newMed.hour || "",
            active: true,
            createdAt: serverTimestamp(),
            medicationType: "PERMANENT",
          });
        }
      }

      await batch.commit();

      setShowForm(false);
      setEditingStudentId(null);
      setFormData({
        firstName: "",
        firstSurname: "",
        secondSurname: "",
        medicationsToAdd: [],
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error al actualizar estudiante/medicamentos:", err.message);
      } else {
        console.error("Ocurrió un error inesperado al actualizar.");
      }
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingStudentId(null);
    setFormData({
      firstName: "",
      firstSurname: "",
      secondSurname: "",
      medicationsToAdd: [],
    });
  };

  // NUEVA FUNCIÓN PARA EXPORTAR LA LISTA A UNA IMAGEN
  const exportListAsImage = async () => {
    if (studentListRef.current) {
      const dataUrl = await htmlToImage.toPng(studentListRef.current, {
        backgroundColor: "white",
      });
      const link = document.createElement("a");
      link.download = `meds-${dateFilter}-${timeRangeFilter}.png`;
      link.href = dataUrl;
      link.click();
    }
  };
  
  // NUEVA FUNCIÓN PARA EXPORTAR LA LISTA DE SOS A PDF
  const exportSosAsPdf = () => {
    const doc = new jsPDF();
    
    const columns = [
      { header: 'Fecha', dataKey: 'date' },
      { header: 'Hora', dataKey: 'hour' },
      { header: 'Estudiante', dataKey: 'studentFullNameSortable' },
      { header: 'Medicamento', dataKey: 'medicationName' },
      { header: 'Dosis', dataKey: 'dosage' },
      { header: 'Observaciones', dataKey: 'notes' }
    ];

    const rows = sosAdmins.map(admin => ({
      date: admin.date,
      hour: admin.hour,
      studentFullNameSortable: admin.studentFullNameSortable,
      medicationName: admin.medicationName,
      dosage: admin.dosage,
      notes: medications.find(m => m.id === admin.medicationId)?.notes || ''
    }));
    
    // @ts-expect-error
    doc.autoTable({
      head: [columns.map(c => c.header)],
      body: rows.map(r => columns.map(c => r[c.dataKey])),
    });

    doc.save(`SOS al ${pdfDate}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <header className="flex flex-col sm:flex-row items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 sm:mb-0">
          Administración de Medicamentos
        </h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setEditingStudentId(null);
              setFormData({
                firstName: "",
                firstSurname: "",
                secondSurname: "",
                medicationsToAdd: [],
              });
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow transition"
          >
            Crear Estudiante
          </button>
          <button
            onClick={() => setShowExtraMedForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl shadow transition"
          >
            + Agregar Medicamento Extra
          </button>
          {/* Nuevo botón para exportar */}
          <button
            onClick={exportListAsImage}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-xl shadow transition"
          >
            Exportar Lista
          </button>
          {/* NUEVO BOTÓN PARA VER MEDICAMENTOS SOS */}
          <button
            onClick={() => {
              setShowSosModal(true);
              setPdfDate(new Date().toISOString().split('T')[0]);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl shadow transition"
          >
            Ver Medicamentos SOS
          </button>
        </div>
      </header>

      <div className="flex gap-2 flex-wrap mb-6">
        <input
          id="dateFilter"
          name="dateFilter"
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="border p-2 rounded-lg shadow-sm"
        />
        <select
          id="timeRangeFilter"
          name="timeRangeFilter"
          value={timeRangeFilter}
          onChange={(e) => setTimeRangeFilter(e.target.value)}
          className="border p-2 rounded-lg shadow-sm"
        >
          <option value="AYUNO/DESAYUNO">Ayuno/Desayuno</option>
          <option value="ALMUERZO">Almuerzo</option>
          <option value="CENA">Cena</option>
          <option value="SOS">SOS</option>
        </select>

        <div className="flex gap-2">
          {["ALL", "GIVEN", "NOSHOW"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as "ALL" | "GIVEN" | "NOSHOW")}
              className={`px-3 py-1 rounded shadow-sm transition ${
                statusFilter === status
                  ? status === "GIVEN"
                    ? "bg-green-600 text-white"
                    : status === "NOSHOW"
                    ? "bg-red-600 text-white"
                    : "bg-blue-600 text-white"
                  : "bg-white hover:bg-gray-100"
              }`}
            >
              {status === "ALL" ? "Todos" : status}
            </button>
          ))}
        </div>
      </div>

      {/* Nuevo: Añadir la referencia al contenedor que se va a exportar */}
      <div ref={studentListRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full text-gray-500 text-center py-10">
            No hay estudiantes para mostrar.
          </div>
        ) : (
          [...filteredStudents]
            .sort((a, b) => a.firstSurname.localeCompare(b.firstSurname))
            .map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedStudent(s)}
                className="bg-white rounded-2xl shadow-md p-4 transition cursor-pointer"
              >
                <p className="font-semibold text-gray-800 mb-2">
                  {s.firstSurname} {s.secondSurname}, {s.firstName}
                </p>
                <div className="space-y-1">
                  {getMedicationsForStudent(s.id).map((med) => {
                    const wasGiven = administrations.some(
                      (a) =>
                        a.studentId === s.id &&
                        a.medicationId === med.id &&
                        a.status === "GIVEN" &&
                        (timeRangeFilter === "AYUNO/DESAYUNO"
                          ? ["AYUNO", "DESAYUNO"].includes(a.timeRange)
                          : a.timeRange === timeRangeFilter)
                    );
                    return (
                      <div
                        key={med.id}
                        className={`flex justify-between items-center border rounded-lg px-3 py-1 ${
                          wasGiven
                            ? "bg-green-100 border-green-400"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{med.medicationName}</span>
                          <span className="text-sm text-gray-500">{med.dosage}</span>
                        </div>
                        {!wasGiven ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGiven(s, med);
                            }}
                            className="bg-green-500 text-white px-3 py-1 rounded-lg"
                          >
                            Given
                          </button>
                        ) : (
                          <span className="text-green-700 font-semibold">✅ Given</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleEditStudent(s);
                        }}
                        className="text-sm text-blue-500 hover:text-blue-700"
                    >
                        Editar
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeactivateStudent(s.id);
                        }}
                        className="text-sm text-red-500 hover:text-red-700"
                    >
                        Eliminar
                    </button>
                </div>
              </div>
            ))
        )}
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-lg w-96 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedStudent(null)}
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold mb-4">
              {selectedStudent.firstSurname} {selectedStudent.secondSurname},{" "}
              {selectedStudent.firstName}
            </h2>

            <div className="space-y-2">
              {getMedicationsForStudent(selectedStudent.id).map((med) => {
                const wasGiven = administrations.some(
                  (a) =>
                    a.studentId === selectedStudent.id &&
                    a.medicationId === med.id &&
                    a.status === "GIVEN" &&
                    (timeRangeFilter === "AYUNO/DESAYUNO"
                      ? ["AYUNO", "DESAYUNO"].includes(a.timeRange)
                      : a.timeRange === timeRangeFilter)
                );
                return (
                  <div
                    key={med.id}
                    className="flex justify-between items-center border rounded-lg px-3 py-1"
                  >
                    <div>
                      <p className="font-medium">{med.medicationName}</p>
                      <p className="text-sm text-gray-500">{med.dosage}</p>
                    </div>
                    {!wasGiven ? (
                      <button
                        onClick={() => handleGiven(selectedStudent, med)}
                        className="bg-green-500 text-white px-3 py-1 rounded-lg"
                      >
                        Given
                      </button>
                    ) : (
                      <span className="text-green-600 font-semibold">✅ Given</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-lg w-96 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleFormClose}
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold mb-4">
              {editingStudentId ? "Editar Estudiante" : "Nuevo Estudiante"}
            </h2>
            <div className="space-y-2">
              <input
                id="firstName"
                name="firstName"
                placeholder="Nombre"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="border p-2 rounded w-full"
              />
              <input
                id="firstSurname"
                name="firstSurname"
                placeholder="Primer Apellido"
                value={formData.firstSurname}
                onChange={(e) =>
                  setFormData({ ...formData, firstSurname: e.target.value })
                }
                className="border p-2 rounded w-full"
              />
              <input
                id="secondSurname"
                name="secondSurname"
                placeholder="Segundo Apellido"
                value={formData.secondSurname}
                onChange={(e) =>
                  setFormData({ ...formData, secondSurname: e.target.value })
                }
                className="border p-2 rounded w-full"
              />

              {formData.medicationsToAdd.map((med, idx) => (
                <div key={idx} className="border p-2 rounded space-y-2">
                  <input
                    id={`medicationName-${idx}`}
                    name={`medicationName-${idx}`}
                    placeholder="Medicamento"
                    value={med.medicationName}
                    onChange={(e) => {
                      const meds = [...formData.medicationsToAdd];
                      meds[idx].medicationName = e.target.value;
                      setFormData({ ...formData, medicationsToAdd: meds });
                    }}
                    className="border p-2 rounded w-full"
                  />
                  <input
                    id={`dosage-${idx}`}
                    name={`dosage-${idx}`}
                    placeholder="Dosis"
                    value={med.dosage}
                    onChange={(e) => {
                      const meds = [...formData.medicationsToAdd];
                      meds[idx].dosage = e.target.value;
                      setFormData({ ...formData, medicationsToAdd: meds });
                    }}
                    className="border p-2 rounded w-full"
                  />
                  <div className="flex flex-wrap gap-2">
                    {["AYUNO", "DESAYUNO", "ALMUERZO", "CENA", "SOS"].map(
                      (tr) => (
                        <button
                          key={tr}
                          type="button"
                          onClick={() => {
                            const meds = [...formData.medicationsToAdd];
                            meds[idx].timeRanges = meds[idx].timeRanges.includes(tr)
                              ? meds[idx].timeRanges.filter((r) => r !== tr)
                              : [...meds[idx].timeRanges, tr];
                            setFormData({ ...formData, medicationsToAdd: meds });
                          }}
                          className={`px-2 py-1 rounded ${
                            med.timeRanges.includes(tr)
                              ? "bg-green-500 text-white"
                              : "bg-gray-200"
                          }`}
                        >
                          {tr}
                        </button>
                      )
                    )}
                  </div>
                  <input
                    id={`startDate-${idx}`}
                    name={`startDate-${idx}`}
                    type="date"
                    value={med.startDate}
                    onChange={(e) => {
                      const meds = [...formData.medicationsToAdd];
                      meds[idx].startDate = e.target.value;
                      setFormData({ ...formData, medicationsToAdd: meds });
                    }}
                    className="border p-2 rounded w-full"
                  />
                  <input
                    id={`endDate-${idx}`}
                    name={`endDate-${idx}`}
                    type="date"
                    value={med.endDate}
                    onChange={(e) => {
                      const meds = [...formData.medicationsToAdd];
                      meds[idx].endDate = e.target.value;
                      setFormData({ ...formData, medicationsToAdd: meds });
                    }}
                    className="border p-2 rounded w-full"
                  />
                  <textarea
                    id={`notes-${idx}`}
                    name={`notes-${idx}`}
                    placeholder="Observaciones"
                    value={med.notes}
                    onChange={(e) => {
                      const meds = [...formData.medicationsToAdd];
                      meds[idx].notes = e.target.value;
                      setFormData({ ...formData, medicationsToAdd: meds });
                    }}
                    className="border p-2 rounded w-full"
                  />
                  <button
                    onClick={() => {
                      const meds = [...formData.medicationsToAdd];
                      meds.splice(idx, 1);
                      setFormData({ ...formData, medicationsToAdd: meds });
                    }}
                    className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                  >
                    Eliminar
                  </button>
                </div>
              ))}

              <button
                onClick={addMedicationField}
                className="bg-gray-200 text-black px-3 py-1 rounded mt-2"
              >
                + Agregar Medicamento
              </button>

              <button
                onClick={editingStudentId ? handleUpdateStudent : handleSaveStudent}
                className="bg-blue-500 text-white px-3 py-1 rounded mt-2 w-full"
              >
                {editingStudentId ? "Guardar Cambios" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExtraMedForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-lg w-96 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowExtraMedForm(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold mb-4">Agregar Medicamento Extra</h2>

            <input
              id="extraFirstName"
              name="extraFirstName"
              placeholder="Nombre del Estudiante"
              value={extraMedForm.firstName}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, firstName: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              id="extraFirstSurname"
              name="extraFirstSurname"
              placeholder="Primer Apellido"
              value={extraMedForm.firstSurname}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, firstSurname: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              id="extraMedicationName"
              name="extraMedicationName"
              placeholder="Medicamento"
              value={extraMedForm.medicationName}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, medicationName: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              id="extraDosage"
              name="extraDosage"
              placeholder="Dosis"
              value={extraMedForm.dosage}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, dosage: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              id="extraHour"
              name="extraHour"
              type="time"
              value={extraMedForm.hour}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, hour: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              id="extraDate"
              name="extraDate"
              type="date"
              value={extraMedForm.date}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, date: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <textarea
              id="extraNotes"
              name="extraNotes"
              placeholder="Observaciones"
              value={extraMedForm.notes}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, notes: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <div className="flex flex-wrap gap-2 mb-2">
              {["AYUNO", "DESAYUNO", "ALMUERZO", "CENA", "SOS"].map((tr) => (
                <button
                  key={tr}
                  type="button"
                  onClick={() => {
                    const trArr = extraMedForm.timeRanges.includes(tr)
                      ? extraMedForm.timeRanges.filter((r) => r !== tr)
                      : [...extraMedForm.timeRanges, tr];
                    setExtraMedForm({ ...extraMedForm, timeRanges: trArr });
                  }}
                  className={`px-2 py-1 rounded ${
                    extraMedForm.timeRanges.includes(tr)
                      ? "bg-green-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  {tr}
                </button>
              ))}
            </div>
            <button
              onClick={handleSaveExtraMed}
              className="bg-purple-500 text-white px-3 py-1 rounded w-full"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
      
      {/* NUEVO MODAL PARA MEDICAMENTOS SOS */}
      {showSosModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-4xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowSosModal(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-4">Medicamentos SOS Administrados</h2>
            
            <button
              onClick={exportSosAsPdf}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow transition mb-4"
            >
              Descargar PDF
            </button>
            
            <table className="min-w-full bg-white border border-gray-200">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Fecha</th>
                  <th className="py-2 px-4 border-b">Hora</th>
                  <th className="py-2 px-4 border-b">Estudiante</th>
                  <th className="py-2 px-4 border-b">Medicamento</th>
                  <th className="py-2 px-4 border-b">Dosis</th>
                  <th className="py-2 px-4 border-b">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {sosAdmins.sort((a, b) => a.date.localeCompare(b.date) || a.hour.localeCompare(b.hour)).map((admin) => (
                  <tr key={admin.id}>
                    <td className="py-2 px-4 border-b">{admin.date}</td>
                    <td className="py-2 px-4 border-b">{admin.hour}</td>
                    <td className="py-2 px-4 border-b">{admin.studentFullNameSortable}</td>
                    <td className="py-2 px-4 border-b">{admin.medicationName}</td>
                    <td className="py-2 px-4 border-b">{admin.dosage}</td>
                    <td className="py-2 px-4 border-b">{medications.find(m => m.id === admin.medicationId)?.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}