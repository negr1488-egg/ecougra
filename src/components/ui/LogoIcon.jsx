import React from 'react';

export default function LogoIcon({ className = "w-10 h-10" }) {
  return (
    <svg 
      className={`${className} shrink-0`}
      width="40" 
      height="40" 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="dropGrad" x1="50" y1="5" x2="50" y2="95" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#00C853" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Фигурные скобки IT ({ }) по бокам */}
      <path 
        d="M26 32 C20 32 17 35 17 40 C17 44 14 47 10 49 C14 51 17 54 17 58 C17 63 20 66 26 66" 
        stroke="#FFAA00" 
        strokeWidth="5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        filter="url(#glow)"
      />
      <path 
        d="M74 32 C80 32 83 35 83 40 C83 44 86 47 90 49 C86 51 83 54 83 58 C83 63 80 66 74 66" 
        stroke="#FFAA00" 
        strokeWidth="5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        filter="url(#glow)"
      />

      {/* Основная капля */}
      <path 
        d="M50 8 C50 8 20 42 20 62 C20 78 33 91 50 91 C67 91 80 78 80 62 C80 42 50 8 50 8Z" 
        fill="url(#dropGrad)" 
        fillOpacity="0.15"
        stroke="url(#dropGrad)" 
        strokeWidth="4"
      />

      {/* Ёлка внутри */}
      <path 
        d="M50 32 L36 48 H43 L33 60 H41 L34 69 H66 L59 60 H67 L57 48 H64 L50 32 Z" 
        fill="#34D399" 
        fillOpacity="0.25"
        stroke="#34D399" 
        strokeWidth="3.5" 
        strokeLinejoin="round"
      />
      <rect x="47" y="69" width="6" height="8" rx="1" fill="#34D399" />
    </svg>
  );
}