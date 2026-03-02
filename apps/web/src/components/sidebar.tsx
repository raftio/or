"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mainItems = [
  {
    label: "Integration",
    href: "/integration",
    match: "exact" as const,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16 3h5v5" />
        <path d="M8 3H3v5" />
        <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
        <path d="m15 9 6-6" />
      </svg>
    ),
  },
  {
    label: "Bundles",
    href: "/bundles",
    match: "prefix" as const,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
  },
  {
    label: "Chat",
    href: "/chat",
    match: "prefix" as const,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

const workspaceItems = [
  {
    label: "Workspace",
    href: "/settings/workspace",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    label: "Members",
    href: "/settings/members",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "API Tokens",
    href: "/settings/api-tokens",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
  },
  {
    label: "Appearance",
    href: "/settings/appearance",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="13.5" cy="6.5" r="2.5" />
        <circle cx="6" cy="12" r="2" />
        <circle cx="18" cy="12" r="2" />
        <circle cx="7.5" cy="18.5" r="2.5" />
        <circle cx="16.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-52 shrink-0 flex-col border-r border-base-border bg-surface-alt">
      <nav className="flex-1 overflow-y-auto px-2.5 pt-3 pb-4">
        <ul className="flex flex-col gap-0.5">
          {mainItems.map(({ label, href, match, icon }) => {
            const active = match === "prefix" ? pathname.startsWith(href) : pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium no-underline transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-base-text-muted hover:bg-primary/5 hover:text-base-text"
                  }`}
                >
                  {icon}
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-5">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-base-text-muted">
            Settings
          </p>
          <ul className="flex flex-col gap-0.5">
            {workspaceItems.map(({ label, href, icon }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium no-underline transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-base-text-muted hover:bg-primary/5 hover:text-base-text"
                    }`}
                  >
                    {icon}
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
