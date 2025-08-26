"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  timeRange: string;
  lastAdministeredAt?: string;
  lastStatus?: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  firstSurname: string;
  firstSurnameSortable: string;
  medications?: Medication[];
}

interface StudentCardProps {
  student: Student;
}

export function StudentCard({ student }: StudentCardProps) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // 🔑 Escuchar cambios en la sesión
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleAdminister = async (med: Medication, status: "GIVEN" | "NO_SHOW") => {
    try {
      if (!user) {
        alert("Debes iniciar sesión para registrar administraciones.");
        return;
      }

      // 1️⃣ Guardar en la colección administrations
      await addDoc(collection(db, "administrations"), {
        studentId: student.id,
        studentFullNameSortable: `${student.firstSurnameSortable}, ${student.firstName}`,
        medId: med.id,
        dosage: med.dosage,
        timeRange: med.timeRange,
        status,
        createdAt: serverTimestamp(),
        date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
        givenByUid: user.uid, // 👈 UID real del usuario
      });

      // 2️⃣ Actualizar estado del medicamento
      const medRef = doc(db, `students/${student.id}/medications/${med.id}`);
      await updateDoc(medRef, {
        lastAdministeredAt: serverTimestamp(),
        lastStatus: status,
      });

      alert(`Registro guardado: ${med.name} → ${status}`);
    } catch (err) {
      console.error("Error guardando administración:", err);
      alert("Error guardando administración");
    }
  };

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-lg transition"
        onClick={() => setOpen(true)}
      >
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold">
            {student.firstName} {student.firstSurname}
          </h2>
          <p className="text-sm text-gray-500">
            {student.medications?.length || 0} medicamento(s)
          </p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Medicamentos de {student.firstName} {student.firstSurname}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {student.medications && student.medications.length > 0 ? (
              student.medications.map((med) => (
                <div
                  key={med.id}
                  className="border p-3 rounded-lg flex flex-col gap-2"
                >
                  <p className="font-medium">{med.name}</p>
                  <p className="text-sm text-gray-500">{med.dosage}</p>
                  <p className="text-xs text-gray-400">Horario: {med.timeRange}</p>

                  {med.lastStatus && (
                    <p className="text-xs text-gray-500">
                      Último: {med.lastStatus}{" "}
                      {med.lastAdministeredAt
                        ? new Date(med.lastAdministeredAt).toLocaleString()
                        : ""}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      onClick={() => handleAdminister(med, "GIVEN")}
                    >
                      ✅ Given
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleAdminister(med, "NO_SHOW")}
                    >
                      ❌ No Show
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p>No tiene medicamentos asignados.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
