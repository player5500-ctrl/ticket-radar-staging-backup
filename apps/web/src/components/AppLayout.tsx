import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ReauthNotice } from "./ReauthNotice";
import { api, isAuthError } from "../services/api";
import "../prototype/DesignTokens.css";

export function AppLayout() {
  const location = useLocation();
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: api.session,
    retry: false,
    staleTime: 60_000,
  });

  const isAdmin = import.meta.env.DEV || sessionQuery.data?.user.role === "admin";
  const needsReauth = !import.meta.env.DEV && isAuthError(sessionQuery.error);

  async function logout() {
    const { logoutUrl } = await api.logout();
    window.location.assign(logoutUrl);
  }

  return (
    <div className="proto-shell proto-wawatype">
      {/* 3D Sticky Header */}
      <header className="proto-header">
        <div className="proto-header-inner">
          <NavLink to="/" className="proto-logo">
            <div className="proto-logo-badge">📡</div>
            <div className="proto-logo-text">
              <span className="proto-logo-title">追票雷達 Ticket Radar</span>
              <span className="proto-logo-subtitle">INTERNAL BETA</span>
            </div>
          </NavLink>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <NavLink
              className="proto-mode-pill"
              to={`/feedback?from=${encodeURIComponent(location.pathname)}`}
            >
              🐞 回報問題
            </NavLink>
            {isAdmin && (
              <NavLink className="proto-mode-pill" to="/admin">
                ⚙️ 管理後台
              </NavLink>
            )}
            {!import.meta.env.DEV && sessionQuery.data && (
              <button
                className="proto-mode-pill"
                type="button"
                onClick={() => void logout()}
              >
                🚪 登出
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="proto-container">
        {needsReauth ? <ReauthNotice /> : <Outlet />}
      </main>

      <footer className="beta-disclaimer" role="note">
        <strong>INTERNAL CLOSED BETA</strong>
        <span>目前為內部封閉測試版本，活動與售票資訊請以官方公告為準。</span>
        <span>本服務不執行自動選票、自動送單或驗證碼操作。</span>
      </footer>

      {/* 5-Item Mobile Bottom Navigation Bar */}
      <nav className="proto-bottom-nav" aria-label="主要行動導覽">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `proto-nav-item ${isActive ? "proto-nav-item--active" : ""}`
          }
        >
          <span className="proto-nav-icon">⌂</span>
          <span>首頁</span>
        </NavLink>

        <NavLink
          to="/search"
          className={({ isActive }) =>
            `proto-nav-item ${isActive ? "proto-nav-item--active" : ""}`
          }
        >
          <span className="proto-nav-icon">⌕</span>
          <span>搜尋</span>
        </NavLink>

        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            `proto-nav-item ${isActive ? "proto-nav-item--active" : ""}`
          }
        >
          <span className="proto-nav-icon">✓</span>
          <span>任務</span>
        </NavLink>

        <NavLink
          to="/battle"
          className={({ isActive }) =>
            `proto-nav-item ${isActive ? "proto-nav-item--active" : ""}`
          }
        >
          <span className="proto-nav-icon">⚡</span>
          <span>作戰</span>
        </NavLink>

        <NavLink
          to="/records"
          className={({ isActive }) =>
            `proto-nav-item ${isActive ? "proto-nav-item--active" : ""}`
          }
        >
          <span className="proto-nav-icon">▤</span>
          <span>紀錄</span>
        </NavLink>
      </nav>
    </div>
  );
}
