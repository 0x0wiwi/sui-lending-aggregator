import type { ReactNode } from "react"

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
    </div>
  )
}
