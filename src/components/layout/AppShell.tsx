import type { ReactNode } from "react"

import { GithubIcon, TwitterIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type AppShellProps = {
  header: ReactNode
  children: ReactNode
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
              aria-label="Twitter"
              className="transition-colors hover:text-foreground"
              href="https://x.com/djdksnel"
              rel="noreferrer"
              target="_blank"
            >
              <TwitterIcon className="h-4 w-4" />
            </a>
            <a
              aria-label="GitHub"
              className="transition-colors hover:text-foreground"
              href="https://github.com/0x0wiwi/sui-lending-aggregator"
              rel="noreferrer"
              target="_blank"
            >
              <GithubIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
