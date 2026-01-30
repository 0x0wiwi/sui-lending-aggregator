import { AppShell } from "@/components/layout/AppShell"
import { Header } from "@/components/Header"
import { MarketDashboard } from "@/components/MarketDashboard"

export function App() {
  return (
    <AppShell header={<Header />}>
      <MarketDashboard />
    </AppShell>
  )
}

export default App
