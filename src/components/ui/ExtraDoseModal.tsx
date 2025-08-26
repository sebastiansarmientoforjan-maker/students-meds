"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface ExtraDoseForm {
  studentId: string;
  studentNameSnapshot: string;
  medicationName: string;
  dosage: string;
  timeRange: "AYUNO" | "DESAYUNO" | "ALMUERZO" | "CENA" | "SOS";
  notes?: string;
}

interface ExtraDoseModalProps {
  students: { id: string; fullName: string }[];
}

export function ExtraDoseModal({ students }: ExtraDoseModalProps) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm<ExtraDoseForm>();

  const onSubmit = async (data: ExtraDoseForm) => {
    setLoading(true);
    try {
      await addDoc(collection(db, "extraDoses"), {
        ...data,
        date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
        status: "GIVEN",
        createdAt: serverTimestamp(),
      });
      reset();
      alert("Dosis extra registrada ✅");
    } catch (error) {
      console.error(error);
      alert("Error al registrar la dosis extra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Registrar dosis extra
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Dosis Extra</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div>
            <label>Estudiante</label>
            <select {...register("studentId", { required: true })} className="w-full border p-2 rounded">
              <option value="">Selecciona estudiante</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Nombre del estudiante (snapshot)</label>
            <input {...register("studentNameSnapshot", { required: true })} className="w-full border p-2 rounded" placeholder="Ej. Pérez Gómez, Juan"/>
          </div>

          <div>
            <label>Medicamento</label>
            <input {...register("medicationName", { required: true })} className="w-full border p-2 rounded"/>
          </div>

          <div>
            <label>Dosis</label>
            <input {...register("dosage", { required: true })} className="w-full border p-2 rounded" placeholder="Ej. 500 mg"/>
          </div>

          <div>
            <label>Tiempo</label>
            <select {...register("timeRange", { required: true })} className="w-full border p-2 rounded">
              <option value="">Selecciona tiempo</option>
              <option value="AYUNO">Ayuno</option>
              <option value="DESAYUNO">Desayuno</option>
              <option value="ALMUERZO">Almuerzo</option>
              <option value="CENA">Cena</option>
              <option value="SOS">SOS</option>
            </select>
          </div>

          <div>
            <label>Notas (opcional)</label>
            <textarea {...register("notes")} className="w-full border p-2 rounded" rows={2}></textarea>
          </div>

          <button type="submit" disabled={loading} className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700">
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
