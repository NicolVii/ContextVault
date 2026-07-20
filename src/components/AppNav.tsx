"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Inbox,
  FileText,
  MessageSquare,
  User,
  Shield,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/memories/new", label: "Add memory", icon: PlusCircle },
  { href: "/review", label: "Review queue", icon: Inbox },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Privacy & data", icon: Shield },
];

export function AppNav({ reviewCount = 0 }: { reviewCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex h-full flex-col gap-1 p-4">
      <Link href="/dashboard" className="mb-4 px-2">
        <Logo />
      </Link>
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-600 text-white"
                : "text-brand-800 hover:bg-brand-50"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            {href === "/review" && reviewCount > 0 && (
              <span className="badge bg-amber-100 text-amber-800">{reviewCount}</span>
            )}
          </Link>
        );
      })}
      <button
        onClick={signOut}
        className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-800 transition-colors hover:bg-brand-50"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </nav>
  );
}
