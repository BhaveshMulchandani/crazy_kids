import { Routes, Route } from "react-router-dom";
import Adminlayout from "./components/Layout/Adminlayout";
import Desklayout from "./components/Layout/Desklayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Admin/Dashboard";
import Billing from "./pages/Desk/Billing";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/admin" element={<Adminlayout />}>
      <Route path="/dashboard" element={<Dashboard/>} />
      </Route>

      <Route path="/desk" element={<Desklayout />}>
      <Route path="/billing" element={<Billing/>} />
      </Route>


    </Routes>
  );
};

export default App;
