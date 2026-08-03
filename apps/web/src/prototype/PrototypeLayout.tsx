import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "./DesignTokens.css";

export function PrototypeLayout() {
  const navigate = useNavigate();

  return (
    <div className="proto-shell proto-wawatype">
      {/* Top Header */}
      <header className="proto-header">
        <div className="proto-header-inner">
          <NavLink to="/prototype" className="proto-logo">
            <div className="proto-logo-badge">📡</div>
            <div className="proto-logo-text">
              <span className="proto-logo-title">追票雷達 Ticket Radar</span>
              <span className="proto-logo-subtitle">UI REDESIGN PROTOTYPE</span>
            </div>
          </NavLink>

          <button
            className="proto-mode-pill"
            onClick={() => navigate("/")}
            title="點擊返回正式版 App 頁面"
          >
            🔄 切換正式版
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="proto-container">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar (5 Items) */}
      <nav className="proto-bottom-nav" aria-label="原型行動導覽列">
        <NavLink
          to="/prototype"
          end
          className={({ isActive }) =>
            `proto-nav-item ${isActive ? "proto-nav-item--active" : ""}`
          }
        >
          <span className="proto-nav-icon">⌂</span>
          <span>首頁</span>
        </NavLink>

        <NavLink
          to="/prototype/search"
          className={({ isActive }) =>
            `proto-nav-item ${isActive ? "proto-nav-item--active" : ""}`
          }
        >
          <span className="proto-nav-icon">⌕</span>
          <span>搜尋</span>
        </NavLink>

        <NavLink
          to="/prototype/tasks"
          className={({ isActive }) =>
            `proto-nav-item ${isActive ? "proto-nav-item--active" : ""}`
          }
        >
          <span className="proto-nav-icon">✓</span>
          <span>任務</span>
        </NavLink>

        <NavLink
          to="/prototype/battle"
          className={({ isActive }) =>
            `proto-nav-item ${isActive ? "proto-nav-item--active" : ""}`
          }
        >
          <span className="proto-nav-icon">⚡</span>
          <span>作戰</span>
        </NavLink>

        <NavLink
          to="/prototype/records"
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
