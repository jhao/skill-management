import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';

export function SplashScreen() {
  const { startupLogs, appStatus, initError } = useAppContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 隐藏 index.html 中的原生启动页，由 React 版本接管，不再恢复
  useEffect(() => {
    const htmlSplash = document.getElementById('html-splash');
    if (htmlSplash) htmlSplash.style.display = 'none';
  }, []);

  // 有新日志时自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [startupLogs.length]);

  const isError = appStatus === 'error';

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] flex flex-col items-center justify-center gap-5 font-sans select-none">
      <AppIcon />

      <div className="text-gray-100 text-xl font-semibold tracking-wide">SKILL Management</div>

      {isError ? (
        <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
          <ErrorIcon />
          启动失败
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <div className="text-gray-500 text-xs">正在启动...</div>
        </div>
      )}

      {/* 日志滚动区 */}
      <div
        ref={scrollRef}
        className="log-scroll"
        style={{
          width: 480,
          maxWidth: '80vw',
          height: 160,
          overflowY: 'scroll',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '8px 12px',
        }}
      >
        {startupLogs.length === 0 ? (
          <div style={{ color: '#4b5563', fontSize: 11, fontFamily: 'monospace' }}>等待日志...</div>
        ) : (
          startupLogs.map((log, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                lineHeight: '1.7',
                color: log.level === 'error' ? '#f87171' : log.level === 'warn' ? '#fbbf24' : '#6b7280',
                // 最新一条稍亮
                opacity: i === startupLogs.length - 1 ? 1 : 0.75,
              }}
            >
              <span style={{ color: '#374151', marginRight: 6 }}>{log.elapsed}</span>
              {log.level === 'error' && <span style={{ color: '#ef4444', marginRight: 4 }}>✗</span>}
              {log.level === 'warn' && <span style={{ color: '#f59e0b', marginRight: 4 }}>△</span>}
              {log.message}
            </div>
          ))
        )}
      </div>

      {isError && initError && (
        <div
          style={{
            width: 480,
            maxWidth: '80vw',
            fontSize: 12,
            color: '#9ca3af',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            lineHeight: 1.6,
            fontFamily: 'monospace',
          }}
        >
          {initError}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        border: '2.5px solid rgba(255,255,255,0.1)',
        borderTopColor: '#0ea5e9',
        animation: 'splash-spin 0.8s linear infinite',
      }}
    />
  );
}

function ErrorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function AppIcon() {
  return (
    <svg width="68" height="68" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="r-bg" x1="128" y1="96" x2="896" y2="928" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="r-folder" x1="220" y1="330" x2="804" y2="760" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F8FAFC" stopOpacity="0.98" />
          <stop offset="1" stopColor="#DBEAFE" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <rect x="72" y="72" width="880" height="880" rx="220" fill="url(#r-bg)" />
      <path
        d="M260 356C260 332.804 278.804 314 302 314H438C447.684 314 457.077 317.337 464.593 323.451L494.407 347.549C501.923 353.663 511.316 357 521 357H722C745.196 357 764 375.804 764 399V426H260V356Z"
        fill="#BFDBFE"
        fillOpacity="0.95"
      />
      <rect x="220" y="392" width="584" height="318" rx="48" fill="url(#r-folder)" />
      <path
        d="M350 645V468H448C493 468 522 492 522 529C522 561 500 578 475 585L531 645H484L435 592H401V645H350ZM401 553H440C460 553 471 543 471 528C471 513 460 505 440 505H401V553Z"
        fill="#1E3A8A"
      />
      <path d="M548 645V468H600V538L667 468H731L657 545L738 645H674L621 579L600 602V645H548Z" fill="#1E3A8A" />
    </svg>
  );
}
