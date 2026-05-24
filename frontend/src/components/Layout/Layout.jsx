import { Outlet } from "react-router-dom";
import Topnav from "../Navbar/Topnav";
import Sidenav from "../Navbar/Sidenav";

const Layout = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* side Navigation */}
      <Sidenav />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        {/* topbar */}
        <Topnav />

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
