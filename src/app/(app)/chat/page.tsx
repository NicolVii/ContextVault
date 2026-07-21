import { redirect } from "next/navigation";

/** Legacy /chat route — Thinking is the primary surface. */
export default function ChatRedirect() {
  redirect("/");
}
