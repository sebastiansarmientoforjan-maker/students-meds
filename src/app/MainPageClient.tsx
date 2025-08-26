"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type MedicationForm = {
  medicationName: string;
  dosage: string;
  timeRanges: string[];
  notes: string;
  startDate: string;
  endDate: string;
  hour?: string;
};

export default function MainPageClient() {
  const [students, setStudents] = useState<any[]>([]);
  const [administrations, setAdministrations] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>("DESAYUNO");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "GIVEN" | "NOSHOW">(
    "ALL"
  );
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
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

  // Cargar estudiantes activos
  useEffect(() => {
    const q = query(collection(db, "students"), where("active", "==", true));
    return onSnapshot(q, (snapshot) => {
      setStudents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  // Cargar administraciones
  useEffect(() => {
    const q = query(
      collection(db, "administrations"),
      where("date", "==", dateFilter),
      where("timeRange", "==", timeRangeFilter)
    );
    return onSnapshot(q, (snapshot) => {
      setAdministrations(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    });
  }, [dateFilter, timeRangeFilter]);

  // Cargar medicamentos
  useEffect(() => {
    const q = query(collection(db, "medications"));
    return onSnapshot(q, (snapshot) => {
      setMedications(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const handleGiven = async (student: any, med: any) => {
    try {
      await addDoc(collection(db, "administrations"), {
        studentId: student.id,
        studentFullNameSortable: `${student.firstSurname} ${student.secondSurname}, ${student.firstName}`,
        medicationId: med.id,
        medicationName: med.medicationName,
        dosage: med.dosage,
        date: dateFilter,
        timeRange: timeRangeFilter,
        status: "GIVEN",
        givenByUid: "test-uid",
        createdAt: serverTimestamp(),
        hour: med.hour || "",
      });
    } catch (err) {
      console.error("Error al guardar administración:", err);
    }
  };

  const filteredStudents = students.filter((s) => {
    const medsForStudent = medications.filter(
      (m) =>
        m.studentId === s.id &&
        m.timeRanges.includes(timeRangeFilter) &&
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
        m.timeRanges.includes(timeRangeFilter) &&
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
        });
      }

      setShowForm(false);
      setFormData({
        firstName: "",
        firstSurname: "",
        secondSurname: "",
        medicationsToAdd: [],
      });
    } catch (err) {
      console.error("Error al guardar estudiante/medicamentos:", err);
    }
  };

  const handleSaveExtraMed = async () => {
    try {
      const student = students.find(
        (s) =>
          s.firstName === extraMedForm.firstName &&
          s.firstSurname === extraMedForm.firstSurname
      );

      if (!student) {
        alert("Estudiante no encontrado");
        return;
      }

      await addDoc(collection(db, "medications"), {
        studentId: student.id,
        medicationName: extraMedForm.medicationName,
        dosage: extraMedForm.dosage,
        timeRanges: extraMedForm.timeRanges,
        notes: extraMedForm.notes,
        startDate: extraMedForm.date,
        endDate: extraMedForm.date,
        hour: extraMedForm.hour,
        active: true,
        createdAt: serverTimestamp(),
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
    } catch (err) {
      console.error("Error al guardar medicamento extra:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 sm:mb-0">
          Administración de Medicamentos
        </h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow transition"
          >
            Crear/Editar Estudiante
          </button>
          <button
            onClick={() => setShowExtraMedForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl shadow transition"
          >
            + Agregar Medicamento Extra
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap mb-6">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="border p-2 rounded-lg shadow-sm"
        />
        <select
          value={timeRangeFilter}
          onChange={(e) => setTimeRangeFilter(e.target.value)}
          className="border p-2 rounded-lg shadow-sm"
        >
          <option value="AYUNO">Ayuno</option>
          <option value="DESAYUNO">Desayuno</option>
          <option value="ALMUERZO">Almuerzo</option>
          <option value="CENA">Cena</option>
          <option value="SOS">SOS</option>
        </select>

        <div className="flex gap-2">
          {["ALL", "GIVEN", "NOSHOW"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
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

      {/* Lista estudiantes */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full text-gray-500 text-center py-10">
            No hay estudiantes para mostrar.
          </div>
        ) : (
          filteredStudents.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedStudent(s)}
              className="bg-white rounded-2xl shadow-md p-4 cursor-pointer hover:shadow-lg transition"
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
                      a.status === "GIVEN"
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
            </div>
          ))
        )}
      </div>

      {/* Modal estudiante */}
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
                    a.status === "GIVEN"
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

      {/* Modal crear/editar estudiante */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-lg w-96 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-black"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold mb-4">Nuevo Estudiante</h2>
            <div className="space-y-2">
              <input
                placeholder="Nombre"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="border p-2 rounded w-full"
              />
              <input
                placeholder="Primer Apellido"
                value={formData.firstSurname}
                onChange={(e) =>
                  setFormData({ ...formData, firstSurname: e.target.value })
                }
                className="border p-2 rounded w-full"
              />
              <input
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
                    placeholder="Observaciones"
                    value={med.notes}
                    onChange={(e) => {
                      const meds = [...formData.medicationsToAdd];
                      meds[idx].notes = e.target.value;
                      setFormData({ ...formData, medicationsToAdd: meds });
                    }}
                    className="border p-2 rounded w-full"
                  />
                </div>
              ))}

              <button
                onClick={addMedicationField}
                className="bg-gray-200 text-black px-3 py-1 rounded mt-2"
              >
                + Agregar Medicamento
              </button>

              <button
                onClick={handleSaveStudent}
                className="bg-blue-500 text-white px-3 py-1 rounded mt-2 w-full"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal medicamento extra */}
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
              placeholder="Nombre del Estudiante"
              value={extraMedForm.firstName}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, firstName: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              placeholder="Primer Apellido"
              value={extraMedForm.firstSurname}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, firstSurname: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              placeholder="Medicamento"
              value={extraMedForm.medicationName}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, medicationName: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              placeholder="Dosis"
              value={extraMedForm.dosage}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, dosage: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              type="time"
              value={extraMedForm.hour}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, hour: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <input
              type="date"
              value={extraMedForm.date}
              onChange={(e) =>
                setExtraMedForm({ ...extraMedForm, date: e.target.value })
              }
              className="border p-2 rounded w-full mb-2"
            />
            <textarea
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
    </div>
  );
}
