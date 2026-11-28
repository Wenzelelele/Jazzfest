"use client";

import { useParams } from "next/navigation";
import { AnfrageSeite } from "@/components/AnfrageSeite";

export default function VeranstalterAnfrageSeite() {
  const { veranstalter } = useParams<{ veranstalter: string }>();
  return <AnfrageSeite veranstalterId={decodeURIComponent(veranstalter)} />;
}
