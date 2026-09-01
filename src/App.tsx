import { useEffect, useState } from "react"
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom"
import { MainLayout } from "@/components/layout"
import {
  DashboardPage,
  CoursesPage,
  SubmissionsPage,
  CompletedPage,
  CEBrokerPipelinePage,
  RosterPostingEntriesPage,
  LogsPage,
  SettingsPage,
  LoginPage,
  SalesDashboardPage,
  SalesOrdersPage,
  SalesCustomersPage,
  SalesProductsPage,
  SalesRevenuePage,
  SalesTransactionsPage,
  SalesRefundsPage,
  SalesReportsPage,
  SalesSyncLogsPage,
  SalesFailedSyncsPage,
  SalesCBAPage,
  SalesCBACompletionsPage,
  SalesCRCBRPage,
  SalesSettingsPage,
} from "@/pages"
import { getTenantAccessProfile, isAuthenticated, touchAuthSession } from "@/lib/auth"

function HomeDashboardRoute() {
  const tenant = getTenantAccessProfile()
  if (tenant.isSuperAdmin) {
    return <Navigate to="/sales/reports" replace />
  }

  return <DashboardPage />
}

function SuperAdminOnlyRoutes() {
  const tenant = getTenantAccessProfile()
  if (!tenant.isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

function StateAdminOnlyRoutes() {
  const tenant = getTenantAccessProfile()
  if (tenant.isSuperAdmin) {
    return <Navigate to="/sales/reports" replace />
  }

  return <Outlet />
}

function RoleDefaultRedirect() {
  const tenant = getTenantAccessProfile()
  return <Navigate to={tenant.isSuperAdmin ? "/sales/reports" : "/"} replace />
}

function RequireAuth() {
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated())

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = ["click", "keydown", "mousemove", "scroll", "touchstart"]

    const onActivity = () => {
      touchAuthSession()
      setAuthenticated(isAuthenticated())
    }

    events.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true })
    })

    const interval = window.setInterval(() => {
      setAuthenticated(isAuthenticated())
    }, 15000)

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity)
      })
      window.clearInterval(interval)
    }
  }, [])

  if (!authenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomeDashboardRoute />} />

            <Route element={<StateAdminOnlyRoutes />}>
              <Route path="courses" element={<CoursesPage />} />
              <Route path="submissions" element={<SubmissionsPage />} />
              <Route path="completed" element={<CompletedPage />} />
              <Route path="pipeline" element={<CEBrokerPipelinePage />} />
              <Route path="roster-posting" element={<RosterPostingEntriesPage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route element={<SuperAdminOnlyRoutes />}>
              <Route path="sales/dashboard" element={<SalesDashboardPage />} />
              <Route path="sales/orders" element={<SalesOrdersPage />} />
              <Route path="sales/customers" element={<SalesCustomersPage />} />
              <Route path="sales/products" element={<SalesProductsPage />} />
              <Route path="sales/revenue" element={<SalesRevenuePage />} />
              <Route path="sales/transactions" element={<SalesTransactionsPage />} />
              <Route path="sales/refunds" element={<SalesRefundsPage />} />
              <Route path="sales/reports" element={<SalesReportsPage />} />
              <Route path="sales/sync-logs" element={<SalesSyncLogsPage />} />
              <Route path="sales/failed-syncs" element={<SalesFailedSyncsPage />} />
              <Route path="sales/cba" element={<SalesCBAPage />} />
              <Route path="sales/cba-sales" element={<SalesReportsPage initialPreset="cba" />} />
              <Route path="sales/cba-completion" element={<SalesCBACompletionsPage />} />
              <Route path="sales/crcbr" element={<SalesCRCBRPage />} />
              <Route path="sales/settings" element={<SalesSettingsPage />} />
            </Route>

            <Route path="*" element={<RoleDefaultRedirect />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
