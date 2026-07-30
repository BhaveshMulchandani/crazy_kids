import { Routes, Route } from "react-router-dom";
import Adminlayout from "./components/Layout/Adminlayout";
import Desklayout from "./components/Layout/Desklayout";
import Login from "./pages/Login";
// import Signup from "./pages/Signup";
import Dashboard from "./pages/Admin/Dashboard";
import MembershipDashboard from "./pages/Desk/MembershipDashboard";
import Billing from "./pages/Desk/Billing";
import Cafepos from "./pages/Desk/Cafepos";
import Customers from "./pages/Admin/Customers";
import Offers from "./pages/Admin/Offers";
import Whatsapp from "./pages/Admin/Whatsapp";
import Settings from "./pages/Admin/Settings";
import MonthlyReports from "./pages/Admin/MonthlyReports";
import Cafemenu from "./pages/Desk/Cafemenu";
import Runningbills from "./pages/Desk/Runningbills"

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      {/* <Route path="/signup" element={<Signup />} /> */}

      <Route path="/admin" element={<Adminlayout />}>
      <Route path="dashboard" element={<Dashboard/>} />
      <Route path="customers" element={<Customers/>}/>
      <Route path="offers" element={<Offers/>}/>
      <Route path="whatsapp" element={<Whatsapp/>}/>
      <Route path="reports" element={<MonthlyReports/>}/>
      <Route path="settings" element={<Settings/>}/>
      </Route>

      <Route path="/desk" element={<Desklayout />}>
      <Route path="billing" element={<Billing/>} />
      <Route path="runningbills" element={<Runningbills/>} />
      <Route path="memberships" element={<MembershipDashboard/>}/>
      <Route path="cafepos" element={<Cafepos/>}/>
      <Route path="cafemenu" element={<Cafemenu/>}/>
      </Route>
    </Routes>
  );
};

export default App;
