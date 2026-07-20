import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = `${import.meta.env.VITE_API_URL}`;

export default function Desktopnav() {
  //const user = JSON.parse(localStorage.getItem("user"));
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef(null);
  const navigate = useNavigate();

  const loadNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE}/notifications/pending`, {
        withCredentials: true,
      });
      setNotifications(res.data?.notifications || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch {
      // Silent — the bell just won't update until the next poll.
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleNotificationClick = async (notification) => {
    setOpen(false);

    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await axios.patch(
          `${API_BASE}/notifications/${notification._id}/read`,
          {},
          { withCredentials: true },
        );
      } catch {
        // Non-fatal — read state will resync on next poll.
      }
    }

    navigate(`/desk/runningbills?highlight=${notification.session}`);
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8 flex items-center justify-end">
      {/* Right Side */}
      <div className="flex items-center gap-4">
        <div className="relative" ref={rootRef}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="relative grid h-10 w-10 place-items-center rounded-full border border-slate-200 transition hover:bg-slate-100"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900">
                Notifications
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">
                    No pending notifications
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification._id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={`flex w-full items-start gap-2 border-b border-slate-50 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${
                        notification.read ? "text-slate-500" : "text-slate-900"
                      }`}
                    >
                      {!notification.read && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                      )}
                      <span className={notification.read ? "" : "ml-0"}>
                        {notification.message}
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {new Date(notification.createdAt).toLocaleString()}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white">
          {user?.email?.charAt(0)?.toUpperCase() || "D"}
        </div> */}
      </div>
    </header>
  );
}
