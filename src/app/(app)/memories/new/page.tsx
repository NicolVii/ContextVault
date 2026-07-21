import { redirect } from "next/navigation";

export default function NewMemoryRedirect() {
  redirect("/vault/memories/new");
}
