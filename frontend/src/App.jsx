const App = () => {
  return (
     <div className="h-screen bg-slate-900 text-white flex flex-col">

      {/* Topbar */}
      <div className="h-16 bg-black flex items-center px-6 text-xl font-bold border-b border-slate-700">
        CRAZY KIDS
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="w-64 bg-slate-800 p-4 hidden md:block">
          <div className="text-lg font-semibold mb-6">Menu</div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-700 rounded-lg cursor-pointer">
              Dashboard
            </div>

            <div className="p-3 bg-slate-700 rounded-lg cursor-pointer">
              Billing
            </div>

            <div className="p-3 bg-slate-700 rounded-lg cursor-pointer">
              Cafe Counter
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-auto">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="bg-slate-800 rounded-2xl p-6 h-40">
              <h2 className="text-lg font-semibold">
                Active Sessions
              </h2>

              <p className="text-4xl mt-4 font-bold">
                15
              </p>
            </div>

            <div className="bg-slate-800 rounded-2xl p-6 h-40">
              <h2 className="text-lg font-semibold">
                Today's Revenue
              </h2>

              <p className="text-4xl mt-4 font-bold">
                ₹12,400
              </p>
            </div>

            <div className="bg-slate-800 rounded-2xl p-6 h-40">
              <h2 className="text-lg font-semibold">
                Customers
              </h2>

              <p className="text-4xl mt-4 font-bold">
                42
              </p>
            </div>

          </div>

        </div>

      </div>

    </div>
  )
}

export default App