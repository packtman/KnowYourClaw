import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import AgentsPage from './pages/AgentsPage'
import AgentProfilePage from './pages/AgentProfilePage'
import DocsPage from './pages/DocsPage'
import PlatformsPage from './pages/PlatformsPage'
import ClaimPage from './pages/ClaimPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="a/:name" element={<AgentProfilePage />} />
        <Route path="docs" element={<DocsPage />} />
        <Route path="platforms" element={<PlatformsPage />} />
        <Route path="claim/:token" element={<ClaimPage />} />
      </Route>
    </Routes>
  )
}

export default App
