import { Bell} from "lucide-react";

export default function Desktopnav() {
    //const user = JSON.parse(localStorage.getItem("user"));
  return (
    <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-end">

      {/* Right Side */}
      <div className="flex items-center gap-4">
        <button className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 transition hover:bg-slate-100">
          <Bell className="h-4 w-4" />
        </button>

        {/* <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white">
          {user?.email?.charAt(0)?.toUpperCase() || "D"}
        </div> */}
      </div>
    </header>
  );
}