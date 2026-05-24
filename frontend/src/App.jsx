import { Routes, Route } from 'react-router-dom'
//import Login from './pages/Login'
// import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Layout from './components/Layout/Layout'

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path='/dashboard' element={<Dashboard />} />
      </Route>
    </Routes>
  )
}

export default App