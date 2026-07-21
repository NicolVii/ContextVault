import { redirect } from "next/navigation";

export default function DocumentsRedirect() {
  redirect("/vault/files");
}
