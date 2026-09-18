import { useEffect, useRef } from "react";

export default function CyberBackground({ theme = "cyber-neon", isInjecting = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Color theme maps
    const themeColors = {
      "cyber-neon": {
        primary: "rgba(0, 240, 255, ",
        secondary: "rgba(157, 78, 223, ",
        grid: "rgba(0, 240, 255, 0.035)",
        beam: "rgba(0, 240, 255, 0.06)",
        bgGradient: ["#050a15", "#091026", "#040712"],
      },
      "quantum-gold": {
        primary: "rgba(255, 183, 3, ",
        secondary: "rgba(255, 140, 0, ",
        grid: "rgba(255, 183, 3, 0.035)",
        beam: "rgba(255, 183, 3, 0.06)",
        bgGradient: ["#120c03", "#1f1405", "#0a0601"],
      },
      "crimson-alert": {
        primary: "rgba(255, 42, 109, ",
        secondary: "rgba(255, 90, 0, ",
        grid: "rgba(255, 42, 109, 0.035)",
        beam: "rgba(255, 42, 109, 0.06)",
        bgGradient: ["#140409", "#240812", "#0b0205"],
      },
      "matrix-emerald": {
        primary: "rgba(0, 255, 157, ",
        secondary: "rgba(0, 200, 100, ",
        grid: "rgba(0, 255, 157, 0.035)",
        beam: "rgba(0, 255, 157, 0.06)",
        bgGradient: ["#03120b", "#062215", "#010a05"],
      },
    };

    const currentPalette = themeColors[theme] || themeColors["cyber-neon"];

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Interactive mouse state
    const mouse = { x: width / 2, y: height / 2, radius: 220, active: false };
    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const handleMouseLeave = () => {
      mouse.active = false;
    };

    // Click shockwave pulses
    let shockwaves = [];
    const handleClick = (e) => {
      shockwaves.push({
        x: e.clientX,
        y: e.clientY,
        radius: 10,
        maxRadius: 260,
        alpha: 0.85,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("click", handleClick);

    // Network Constellation Nodes (High-tech server topology particles)
    const nodeCount = Math.floor(Math.min(width, 1600) / 16);
    const nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 2.2 + 1.2,
      alpha: Math.random() * 0.5 + 0.3,
      isPulseNode: Math.random() > 0.85,
      colorType: Math.random() > 0.35 ? "primary" : "secondary",
    }));

    // Data energy packets flowing along network links
    let dataPackets = [];

    let scanlineY = 0;
    let frameCount = 0;

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, width, height);

      // 1. Deep Space Ambient Background Radial Lights
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, currentPalette.bgGradient[0]);
      bgGrad.addColorStop(0.5, currentPalette.bgGradient[1]);
      bgGrad.addColorStop(1, currentPalette.bgGradient[2]);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Soft ambient glowing orb in center top
      const topOrb = ctx.createRadialGradient(width * 0.5, height * 0.2, 20, width * 0.5, height * 0.2, 500);
      topOrb.addColorStop(0, `${currentPalette.primary}0.08)`);
      topOrb.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = topOrb;
      ctx.fillRect(0, 0, width, height);

      // 2. Futuristic Grid Matrix
      const gridSize = 70;
      ctx.strokeStyle = currentPalette.grid;
      ctx.lineWidth = 1;

      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Scanner Line Beam
      scanlineY = (scanlineY + 1.2) % height;
      const beamGradient = ctx.createLinearGradient(0, scanlineY - 70, 0, scanlineY + 70);
      beamGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      beamGradient.addColorStop(0.5, currentPalette.beam);
      beamGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = beamGradient;
      ctx.fillRect(0, scanlineY - 70, width, 140);

      // 4. Click shockwaves
      shockwaves = shockwaves.filter((wave) => wave.alpha > 0.02);
      for (const wave of shockwaves) {
        wave.radius += 7;
        wave.alpha *= 0.94;

        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `${currentPalette.primary}${wave.alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 18;
        ctx.shadowColor = `${currentPalette.primary}0.9)`;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 5. Constellation Network Nodes & Dynamic Laser Connections
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Mouse interaction
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const angle = Math.atan2(dy, dx);
            const force = (mouse.radius - dist) / mouse.radius;
            p.x -= Math.cos(angle) * force * 3;
            p.y -= Math.sin(angle) * force * 3;
          }
        }

        const col = currentPalette[p.colorType];

        // Draw node dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${col}${p.alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `${col}0.8)`;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Pulse ring around special server nodes
        if (p.isPulseNode) {
          const pulseR = p.radius + 4 + Math.sin(frameCount * 0.05 + i) * 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, pulseR, 0, Math.PI * 2);
          ctx.strokeStyle = `${col}0.35)`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        // Connect nearby nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const p2 = nodes[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 135) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const lineAlpha = (1 - dist / 135) * 0.2;
            ctx.strokeStyle = `${currentPalette.primary}${lineAlpha})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();

            // Randomly spawn data packet pulse along active link during injection
            if (isInjecting && Math.random() < 0.003 && dataPackets.length < 20) {
              dataPackets.push({
                x1: p.x,
                y1: p.y,
                x2: p2.x,
                y2: p2.y,
                progress: 0,
                speed: 0.03 + Math.random() * 0.04,
              });
            }
          }
        }
      }

      // Render data packets
      dataPackets = dataPackets.filter((pkt) => pkt.progress < 1);
      for (const pkt of dataPackets) {
        pkt.progress += pkt.speed;
        const curX = pkt.x1 + (pkt.x2 - pkt.x1) * pkt.progress;
        const curY = pkt.y1 + (pkt.y2 - pkt.y1) * pkt.progress;

        ctx.beginPath();
        ctx.arc(curX, curY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `${currentPalette.primary}0.95)`;
        ctx.shadowBlur = 12;
        ctx.shadowColor = `${currentPalette.primary}1)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("click", handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, isInjecting]);

  return <canvas ref={canvasRef} className="cyber-canvas" aria-hidden="true" />;
}
