import { VaultShell } from "@/components/VaultShell";

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return <VaultShell>{children}</VaultShell>;
}
