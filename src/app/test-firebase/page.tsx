"use client";
import { useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function TestFirebase() {
  useEffect(() => {
    async function fetchData() {
      const col = collection(db, "students");
      const snapshot = await getDocs(col);
      console.log(snapshot.docs.map(doc => doc.data()));
    }
    fetchData();
  }, []);

  return <div>Firebase conectado. Revisa la consola del navegador.</div>;
}
