import { readdirSync } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";

// Opens the first page under designs/.
export default function Home() {
  const first = readdirSync(path.join(process.cwd(), "designs"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort()[0];
  redirect(`/${first ?? "start"}`);
}
