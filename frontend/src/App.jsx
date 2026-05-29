import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Billing from "./pages/Billing";
import Cafemenu from "./pages/Cafemenu";
import Cafepos from "./pages/Cafepos";
import Customers from "./pages/Customers";
import Offers from "./pages/Offers";
import Sessions from "./pages/Sessions";
import Settings from "./pages/Settings";
import Whatsapp from "./pages/Whatsapp";


const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/billing" element={<Billing/>} />
        <Route path="/cafemenu" element={<Cafemenu/>} />
        <Route path="/cafepos" element={<Cafepos/>} />
        <Route path="/customers" element={<Customers/>} />
        <Route path="/offers" element={<Offers/>} />
        <Route path="/sessions" element={<Sessions/>} />
        <Route path="/settings" element={<Settings/>} />
        <Route path="/whatsapp" element={<Whatsapp/>} />
      </Route>
    </Routes>
  );
};

export default App;
