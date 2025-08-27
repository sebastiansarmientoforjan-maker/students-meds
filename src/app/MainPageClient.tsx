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
  Timestamp,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as htmlToImage from "html-to-image";

// Definimos los tipos para la base de datos
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

type ExtraMedForm = {
  medicationName: string;
  dosage: string;
  notes: string;
  timeRanges: string[];
};

export default function MainPageClient() {
  const [students, setStudents] = useState<Student[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [administrations, setAdministrations] = useState<Administration[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [dateFilter, setDateFilter] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [timeRangeFilter, setTimeRangeFilter] = useState("AYUNO/DESAYUNO");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "GIVEN" | "NOSHOW"
  >("ALL");
  const [showForm, setShowForm] = useState(false);
  const [showExtraMedForm, setShowExtraMedForm] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    firstName: string;
    firstSurname: string;
    secondSurname: string;
    medicationsToAdd: MedicationForm[];
  }>({
    firstName: "",
    firstSurname: "",
    secondSurname: "",
    medicationsToAdd: [],
  });

  const [extraMedForm, setExtraMedForm] = useState<ExtraMedForm>({
    medicationName: "",
    dosage: "",
    notes: "",
    timeRanges: [],
  });

  const [showExtraMedsPopup, setShowExtraMedsPopup] = useState(false);
  const [extraMedsStartDate, setExtraMedsStartDate] = useState("");
  const [extraMedsEndDate, setExtraMedsEndDate] = useState("");
  const [filteredExtraMeds, setFilteredExtraMeds] = useState<Administration[]>([]);

  const studentListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const studentsUnsubscribe = onSnapshot(
      collection(db, "students"),
      (snapshot) => {
        const studentsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Student[];
        setStudents(studentsData);
      }
    );

    const medicationsUnsubscribe = onSnapshot(
      collection(db, "medications"),
      (snapshot) => {
        const medicationsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Medication[];
        setMedications(medicationsData);
      }
    );

    const administrationsUnsubscribe = onSnapshot(
      collection(db, "administrations"),
      (snapshot) => {
        const administrationsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Administration[];
        setAdministrations(administrationsData);
      }
    );

    return () => {
      studentsUnsubscribe();
      medicationsUnsubscribe();
      administrationsUnsubscribe();
    };
  }, []);

  useEffect(() => {
    const newFilteredStudents = students.filter((student) => {
      const studentMedications = medications.filter(
        (med) =>
          med.studentId === student.id &&
          med.timeRanges.includes(timeRangeFilter.split("/")[0]) &&
          new Date(dateFilter) >= new Date(med.startDate) &&
          new Date(dateFilter) <= new Date(med.endDate)
      );

      const hasExtraMeds = medications.some(
        (med) =>
          med.studentId === "" &&
          med.timeRanges.includes(timeRangeFilter.split("/")[0]) &&
          new Date(dateFilter) >= new Date(med.startDate) &&
          new Date(dateFilter) <= new Date(med.endDate)
      );

      const studentHasMedicationForTimeRange =
        studentMedications.length > 0 || hasExtraMeds;

      if (!studentHasMedicationForTimeRange) {
        return false;
      }

      const hasAdmin = administrations.some(
        (admin) =>
          admin.studentId === student.id &&
          admin.date === dateFilter &&
          admin.timeRange === timeRangeFilter &&
          (statusFilter === "ALL" || admin.status === statusFilter)
      );

      return statusFilter === "ALL" || hasAdmin;
    });

    setFilteredStudents(newFilteredStudents);
  }, [students, medications, administrations, dateFilter, timeRangeFilter, statusFilter]);

  const handleCreateOrUpdateStudent = async () => {
    if (!formData.firstName || !formData.firstSurname) {
      alert("Por favor, complete los campos obligatorios.");
      return;
    }

    try {
      if (editingStudentId) {
        const studentDocRef = doc(db, "students", editingStudentId);
        await updateDoc(studentDocRef, {
          firstName: formData.firstName,
          firstSurname: formData.firstSurname,
          secondSurname: formData.secondSurname,
          updatedAt: serverTimestamp(),
        });
      } else {
        const newStudentDoc = await addDoc(collection(db, "students"), {
          firstName: formData.firstName,
          firstSurname: formData.firstSurname,
          secondSurname: formData.secondSurname,
          active: true,
          createdAt: serverTimestamp(),
        });

        const batch = writeBatch(db);
        formData.medicationsToAdd.forEach((med) => {
          const medRef = doc(collection(db, "medications"));
          batch.set(medRef, {
            ...med,
            studentId: newStudentDoc.id,
            active: true,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      setShowForm(false);
      setEditingStudentId(null);
      setFormData({
        firstName: "",
        firstSurname: "",
        secondSurname: "",
        medicationsToAdd: [],
      });
    } catch (error) {
      console.error("Error al crear/actualizar estudiante:", error);
    }
  };

  const handleSaveExtraMed = async () => {
    if (!extraMedForm.medicationName || extraMedForm.timeRanges.length === 0) {
      alert("Por favor, complete el nombre y los horarios del medicamento.");
      return;
    }

    try {
      await addDoc(collection(db, "medications"), {
        ...extraMedForm,
        studentId: "",
        active: true,
        createdAt: serverTimestamp(),
        startDate: new Date().toISOString().split("T")[0],
        endDate: "2099-12-31",
      });

      setShowExtraMedForm(false);
      setExtraMedForm({
        medicationName: "",
        dosage: "",
        notes: "",
        timeRanges: [],
      });
    } catch (error) {
      console.error("Error al guardar medicamento extra:", error);
    }
  };

  const handleAdminStatusUpdate = async (
    studentId: string,
    medication: Medication,
    status: "GIVEN" | "NOSHOW"
  ) => {
    const adminQuery = query(
      collection(db, "administrations"),
      where("studentId", "==", studentId),
      where("medicationId", "==", medication.id),
      where("date", "==", dateFilter),
      where("timeRange", "==", timeRangeFilter)
    );

    const snapshot = await getDocs(adminQuery);

    if (snapshot.empty) {
      await addDoc(collection(db, "administrations"), {
        studentId,
        studentFullNameSortable: `${
          students.find((s) => s.id === studentId)?.firstSurname
        } ${
          students.find((s) => s.id === studentId)?.secondSurname
        } ${students.find((s) => s.id === studentId)?.firstName}`,
        medicationId: medication.id,
        medicationName: medication.medicationName,
        dosage: medication.dosage,
        date: dateFilter,
        timeRange: timeRangeFilter,
        status,
        givenByUid: "placeholder_uid",
        createdAt: serverTimestamp(),
      });
    } else {
      const adminDoc = snapshot.docs[0];
      await updateDoc(doc(db, "administrations", adminDoc.id), {
        status,
        updatedAt: serverTimestamp(),
      });
    }
  };

  const getStudentAdminStatus = (studentId: string, medicationId: string) => {
    const admin = administrations.find(
      (a) =>
        a.studentId === studentId &&
        a.medicationId === medicationId &&
        a.date === dateFilter &&
        a.timeRange === timeRangeFilter
    );
    return admin?.status || "PENDING";
  };

  const exportListAsImage = () => {
    if (studentListRef.current) {
      htmlToImage
        .toPng(studentListRef.current)
        .then(function (dataUrl) {
          const link = document.createElement("a");
          link.download = `lista_medicamentos_${dateFilter}_${timeRangeFilter}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch(function (error) {
          console.error("oops, algo salió mal!", error);
        });
    }
  };

  const handleShowExtraMedsGiven = async () => {
    if (!extraMedsStartDate || !extraMedsEndDate) {
      alert("Por favor, seleccione un rango de fechas.");
      return;
    }

    const q = query(
      collection(db, "administrations"),
      where("studentId", "==", ""),
      where("status", "==", "GIVEN")
    );

    const querySnapshot = await getDocs(q);
    const allExtraMedsGiven: Administration[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Administration[];

    const start = new Date(extraMedsStartDate);
    const end = new Date(extraMedsEndDate);

    const filtered = allExtraMedsGiven.filter(admin => {
      const adminDate = new Date(admin.date);
      return adminDate >= start && adminDate <= end;
    });

    setFilteredExtraMeds(filtered);
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
          <button
            onClick={() => setShowExtraMedsPopup(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl shadow transition"
          >
            Ver Medicamentos Extras Entregados
          </button>
          <button
            onClick={exportListAsImage}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-xl shadow transition"
          >
            Exportar Lista
          </button>
        </div>
      </header>

      <div ref={studentListRef}>
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStudents.length === 0 ? (
            <div className="col-span-full text-gray-500 text-center py-10">
              No hay estudiantes para mostrar.
            </div>
          ) : (
            filteredStudents.map((student) => (
              <div
                key={student.id}
                className="bg-white p-6 rounded-xl shadow-lg border border-gray-200"
              >
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  {student.firstName} {student.firstSurname}{" "}
                  {student.secondSurname}
                </h2>
                <div className="space-y-4">
                  {medications
                    .filter(
                      (med) =>
                        med.studentId === student.id &&
                        med.timeRanges.includes(timeRangeFilter.split("/")[0]) &&
                        new Date(dateFilter) >= new Date(med.startDate) &&
                        new Date(dateFilter) <= new Date(med.endDate)
                    )
                    .map((med) => (
                      <div
                        key={med.id}
                        className="bg-gray-100 p-3 rounded-lg border-l-4 border-l-blue-500"
                      >
                        <p className="font-medium text-gray-700">
                          {med.medicationName} ({med.dosage})
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {med.notes}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() =>
                              handleAdminStatusUpdate(
                                student.id,
                                med,
                                "GIVEN"
                              )
                            }
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                              getStudentAdminStatus(student.id, med.id) === "GIVEN"
                                ? "bg-green-600 text-white"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            DADO
                          </button>
                          <button
                            onClick={() =>
                              handleAdminStatusUpdate(
                                student.id,
                                med,
                                "NOSHOW"
                              )
                            }
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                              getStudentAdminStatus(student.id, med.id) === "NOSHOW"
                                ? "bg-red-600 text-white"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                            }`}
                          >
                            NO APARECE
                          </button>
                        </div>
                      </div>
                    ))}
                  {medications
                    .filter(
                      (med) =>
                        med.studentId === "" &&
                        med.timeRanges.includes(timeRangeFilter.split("/")[0]) &&
                        new Date(dateFilter) >= new Date(med.startDate) &&
                        new Date(dateFilter) <= new Date(med.endDate)
                    )
                    .map((med) => (
                      <div
                        key={med.id}
                        className="bg-gray-100 p-3 rounded-lg border-l-4 border-l-purple-500"
                      >
                        <p className="font-medium text-gray-700">
                          {med.medicationName} ({med.dosage})
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {med.notes}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-4">
              {editingStudentId ? 'Editar Estudiante' : 'Crear Estudiante'}
            </h2>
            <input
              type="text"
              name="firstName"
              placeholder='Nombre'
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              type="text"
              name="firstSurname"
              placeholder='Primer Apellido'
              value={formData.firstSurname}
              onChange={(e) =>
                setFormData({ ...formData, firstSurname: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              type="text"
              name="secondSurname"
              placeholder='Segundo Apellido'
              value={formData.secondSurname}
              onChange={(e) =>
                setFormData({ ...formData, secondSurname: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowForm(false)}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateOrUpdateStudent}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                {editingStudentId ? 'Guardar Cambios' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExtraMedForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-4">Agregar Medicamento Extra</h2>
            <input
              id="medicationName"
              name="medicationName"
              placeholder='Nombre del medicamento'
              value={extraMedForm.medicationName}
              onChange={(e) =>
                setExtraMedForm({
                  ...extraMedForm,
                  medicationName: e.target.value,
                })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              id="dosage"
              name="dosage"
              placeholder='Dosificación'
              value={extraMedForm.dosage}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, dosage: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <textarea
              id="extraNotes"
              name="extraNotes"
              placeholder='Observaciones'
              value={extraMedForm.notes}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, notes: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <div className="flex flex-wrap gap-2 mb-2">
              {['AYUNO', 'DESAYUNO', 'ALMUERZO', 'CENA', 'SOS'].map((tr) => (
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
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200'
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

      {showExtraMedsPopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Medicamentos Extra Entregados</h2>
            <div className="mb-4">
              <label htmlFor="extraMedsStartDate" className="block text-sm font-medium text-gray-700">
                Fecha de inicio
              </label>
              <input
                type="date"
                id="extraMedsStartDate"
                value={extraMedsStartDate}
                onChange={(e) => setExtraMedsStartDate(e.target.value)}
                className="mt-1 block w-full border p-2 rounded-lg"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="extraMedsEndDate" className="block text-sm font-medium text-gray-700">
                Fecha de fin
              </label>
              <input
                type="date"
                id="extraMedsEndDate"
                value={extraMedsEndDate}
                onChange={(e) => setExtraMedsEndDate(e.target.value)}
                className="mt-1 block w-full border p-2 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 mb-4">
              <button
                onClick={handleShowExtraMedsGiven}
                className="bg-emerald-600 text-white px-4 py-2 rounded-xl shadow transition"
              >
                Mostrar
              </button>
              <button
                onClick={() => {
                  setShowExtraMedsPopup(false);
                  setFilteredExtraMeds([]);
                  setExtraMedsStartDate("");
                  setExtraMedsEndDate("");
                }}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded-xl shadow transition"
              >
                Cerrar
              </button>
            </div>
            {filteredExtraMeds.length > 0 ? (
              <div className="space-y-4">
                {filteredExtraMeds.map((admin) => (
                  <div key={admin.id} className="bg-gray-100 p-4 rounded-lg shadow-sm border-l-4 border-l-emerald-500">
                    <p className="font-semibold text-gray-800">{admin.medicationName} ({admin.dosage})</p>
                    <p className="text-sm text-gray-600">Fecha: {admin.date}</p>
                    <p className="text-sm text-gray-600">Horario: {admin.timeRange}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500">
                No hay medicamentos extra registrados como 'dados' en este rango de fechas.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
