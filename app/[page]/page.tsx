import { Suspense } from "react";
import { Lienzo } from "@/lienzo/lienzo";

export default function Page({ params }: PageProps<"/[page]">) {
  return (
    <Suspense fallback={<div className="h-dvh bg-neutral-100" />}>
      <Lienzo params={params} />
    </Suspense>
  );
}
