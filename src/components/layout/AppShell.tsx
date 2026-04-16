import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type AppShellProps = {
  header: ReactNode
  children: ReactNode
}

function XBrandIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 fill-current"
      viewBox="0 0 24 24"
    >
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </svg>
  )
}

function GitHubBrandIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 fill-current"
      viewBox="0 0 24 24"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

export function AppShell({ header, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          {header}
        </div>
      </div>
      <main className={cn("mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-6")}>
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-4 text-xs text-muted-foreground md:px-6">
          <div className="flex items-center gap-3">
            <a
              aria-label="X"
              className="transition-colors hover:text-foreground"
              href="https://x.com/djdksnel"
              rel="noreferrer"
              target="_blank"
            >
              <XBrandIcon />
            </a>
            <a
              aria-label="GitHub"
              className="transition-colors hover:text-foreground"
              href="https://github.com/0x0wiwi/sui-lending-aggregator"
              rel="noreferrer"
              target="_blank"
            >
              <GitHubBrandIcon />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
