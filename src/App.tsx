import { BrowserRouter, Routes, Route } from "react-router-dom"
import { MainLayout } from "@/components/layout"
import {
  DashboardPage,
  CoursesPage,
  SubmissionsPage,
  PipelinePage,
  LogsPage,
  SettingsPage,
} from "@/pages"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="submissions" element={<SubmissionsPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
