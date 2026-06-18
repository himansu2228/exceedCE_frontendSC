import { BrowserRouter, Routes, Route } from "react-router-dom"
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
} from "@/pages"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="submissions" element={<SubmissionsPage />} />
          <Route path="completed" element={<CompletedPage />} />
          <Route path="pipeline" element={<CEBrokerPipelinePage />} />
          <Route path="roster-posting" element={<RosterPostingEntriesPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
