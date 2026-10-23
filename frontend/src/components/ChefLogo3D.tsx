import React, { useState, useRef } from 'react';
import { UtensilsCrossed, Sparkles } from 'lucide-react';

interface ChefLogo3DProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  showSparkle?: boolean;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

export const ChefLogo3D: React.FC<ChefLogo3DProps> = ({
  size = 'md',
  showSparkle = true,
  interactive = true,
  className = '',
  onClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Size configurations
  const sizeMap = {
    sm: { box: 'w-9 h-9', icon: 'w-4 h-4', rounded: 'rounded-xl', stroke: 2.2, badge: 'w-3.5 h-3.5' },
    md: { box: 'w-11 h-11', icon: 'w-5 h-5 sm:w-6 sm:h-6', rounded: 'rounded-2xl', stroke: 2.4, badge: 'w-4 h-4' },
    lg: { box: 'w-14 h-14', icon: 'w-7 h-7', rounded: 'rounded-2xl', stroke: 2.5, badge: 'w-5 h-5' },
    xl: { box: 'w-20 h-20', icon: 'w-10 h-10', rounded: 'rounded-3xl', stroke: 2.6, badge: 'w-6 h-6' },
    hero: { box: 'w-28 h-28', icon: 'w-14 h-14', rounded: 'rounded-[32px]', stroke: 2.8, badge: 'w-8 h-8' },
  };

  const currentSize = sizeMap[size];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Dynamic tilt angle up to ±28 degrees
    const rotateY = (x - 0.5) * 32;
    const rotateX = (0.5 - y) * 32;
    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-block select-none cursor-pointer group ${className}`}
      style={{ perspective: '1000px' }}
    >
      <style>{`
        @keyframes chefLogoFloat {
          0%, 100% {
            transform: rotateX(8deg) rotateY(-8deg) translateY(0px) rotateZ(-1deg);
          }
          50% {
            transform: rotateX(-6deg) rotateY(10deg) translateY(-4px) rotateZ(1deg);
          }
        }
        @keyframes chefLogoSheen {
          0% {
            transform: translateX(-150%) translateY(-150%) rotate(40deg);
            opacity: 0;
          }
          20% {
            opacity: 0.85;
          }
          45%, 100% {
            transform: translateX(200%) translateY(200%) rotate(40deg);
            opacity: 0;
          }
        }
        @keyframes chefPulseGlow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.15);
          }
        }
      `}</style>

      {/* 3D Ambient Volumetric Floor Glow */}
      <div 
        className="absolute inset-0 bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400 blur-xl rounded-full pointer-events-none transition-all duration-300"
        style={{
          animation: !isHovered ? 'chefPulseGlow 3s ease-in-out infinite' : undefined,
          opacity: isHovered ? 0.9 : 0.6,
          transform: isHovered ? 'scale(1.25)' : undefined,
        }}
      />

      {/* Floating 3D Sparkle Star */}
      {showSparkle && (
        <div 
          className="absolute -top-1 -right-1 z-30 pointer-events-none transition-transform duration-300"
          style={{
            transform: isHovered 
              ? 'translate3d(5px, -5px, 25px) scale(1.2) rotate(20deg)' 
              : 'translate3d(0, 0, 15px)',
          }}
        >
          <div className={`${currentSize.badge} rounded-full bg-gradient-to-tr from-amber-300 to-yellow-200 shadow-md shadow-amber-400/60 flex items-center justify-center border border-white/80 animate-bounce`}>
            <Sparkles className="w-2.5 h-2.5 text-orange-950" />
          </div>
        </div>
      )}

      {/* 3D Main Chassis Layer */}
      <div
        className={`relative ${currentSize.box} ${currentSize.rounded} flex items-center justify-center transition-transform duration-200 ease-out`}
        style={{
          transformStyle: 'preserve-3d',
          transform: isHovered
            ? `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) translateZ(14px) scale(1.08)`
            : undefined,
          animation: !isHovered ? 'chefLogoFloat 4s ease-in-out infinite' : undefined,
          background: 'linear-gradient(135deg, #FF781E 0%, #F55502 48%, #DC3600 100%)',
          boxShadow: isHovered
            ? `
              0 24px 38px -6px rgba(249, 115, 22, 0.65),
              0 14px 20px -4px rgba(234, 88, 12, 0.45),
              0 0 0 1.5px rgba(255, 255, 255, 0.55) inset,
              0 3px 5px 0 rgba(255, 255, 255, 0.7) inset,
              0 -4px 9px 0 rgba(140, 38, 0, 0.75) inset,
              0 7px 0 0 #b33200
            `
            : `
              0 14px 26px -4px rgba(249, 115, 22, 0.45),
              0 8px 12px -3px rgba(234, 88, 12, 0.35),
              0 0 0 1px rgba(255, 255, 255, 0.45) inset,
              0 2.5px 3.5px 0 rgba(255, 255, 255, 0.6) inset,
              0 -3px 6px 0 rgba(140, 38, 0, 0.65) inset,
              0 5px 0 0 #b33200
            `,
        }}
      >
        {/* Specular Diagonal Light Sweep Sheen */}
        <div 
          className="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none"
          style={{ transform: 'translateZ(2px)' }}
        >
          <div 
            className="absolute -inset-full bg-gradient-to-tr from-transparent via-white/40 to-transparent pointer-events-none"
            style={{
              animation: !isHovered ? 'chefLogoSheen 4.5s ease-in-out infinite' : undefined,
              transform: isHovered
                ? `translateX(${(rotate.y + 16) * 4}%) translateY(${(-rotate.x + 16) * 4}%) rotate(40deg)`
                : undefined,
            }}
          />
          {/* Top-rim curved bevel gloss */}
          <div className="absolute top-0 inset-x-1.5 h-1/2 bg-gradient-to-b from-white/40 via-white/10 to-transparent rounded-t-[inherit]" />
        </div>

        {/* 3D Elevated White Cutlery Icon (Fork & Knife) */}
        <div
          className="relative z-10 flex items-center justify-center text-white"
          style={{
            transform: 'translateZ(22px)',
            filter: 'drop-shadow(0 4px 6px rgba(110, 24, 0, 0.5)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))',
            transition: 'transform 0.2s ease-out',
          }}
        >
          <UtensilsCrossed 
            className={`${currentSize.icon}`} 
            strokeWidth={currentSize.stroke} 
          />
        </div>

        {/* 3D Bottom Bevel Shade */}
        <div 
          className="absolute inset-x-0 bottom-0 h-2 rounded-b-[inherit] bg-black/25 pointer-events-none"
          style={{ transform: 'translateZ(1px)' }}
        />
      </div>
    </div>
  );
};
