import React from 'react';

export default function LogoIcon({ className = "w-10 h-10" }) {
  return (
    <svg 
      className={`${className} shrink-0`}
      width="40" 
      height="40" 
      viewBox="0 0 110 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="dropGrad" x1="55" y1="5" x2="55" y2="95" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#00C853" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Левая фигурная скобка ({) смещена влево, чтобы не пересекаться с каплей */}
      <path 
        d="M22 32 C16 32 13 35 13 40 C13 44 10 47 6 49 C10 51 13 54 13 58 C13 63 16 66 22 66" 
        stroke="#FFAA00" 
        strokeWidth="5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        filter="url(#glow)"
      />
      
      {/* Правая фигурная скобка (}) смещена вправо */}
      <path 
        d="M88 32 C94 32 97 35 97 40 C97 44 100 47 104 49 C100 51 97 54 97 58 C97 63 94 66 88 66" 
        stroke="#FFAA00" 
        strokeWidth="5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        filter="url(#glow)"
      />

      {/* Основная капля по центру */}
      <path 
        d="M55 8 C55 8 27 42 27 62 C27 78 39 91 55 91 C71 91 83 78 83 62 C83 42 55 8 55 8Z" 
        fill="url(#dropGrad)" 
        fillOpacity="0.15"
        stroke="url(#dropGrad)" 
        strokeWidth="4"
      />

      {/* Аккуратная ёлка внутри капли с отступами */}
      <path 
        d="M55 33 L42 48 H48 L40 59 H47 L41 68 H69 L63 59 H70 L62 48 H68 L55 33 Z" 
        fill="#34D399" 
        fillOpacity="0.25"
        stroke="#34D399" 
        strokeWidth="3.5" 
        strokeLinejoin="round"
      />
      <rect x="52" y="68" width="6" height="8" rx="1" fill="#34D399" />
    </svg>
  );
}