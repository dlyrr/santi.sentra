import { useEffect, useRef } from "react";
import { getPreset, type RainArtwork } from "./presets";

/**
 * The falling sprites voxlis.NET and Sirmeme drop down the window.
 *
 * Ported from santi.weblauncher, which draws them on a canvas rather than as
 * DOM nodes: forty-odd independently rotating sprites are cheap to draw and
 * expensive to lay out, and a canvas cannot accidentally intercept a click.
 */

interface ThemeRainProps {
  /** The active preset id, or null for the built-in theme. */
  presetId: string | null | undefined;
}

export const ThemeRain = ({ presetId }: ThemeRainProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(0);

  const rain: RainArtwork | undefined = getPreset(presetId)?.rain;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rain) return;

    // Motion is decoration; honour the preference rather than overriding it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const sprite = new Image();
    let ready = false;
    sprite.addEventListener("load", () => {
      ready = true;
    });
    sprite.src = rain.src;

    // Backing store follows devicePixelRatio, or the sprites come out soft.
    let ratio = 1;
    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
    };
    resize();
    window.addEventListener("resize", resize);

    // Scaled by area so a maximised window gets proportionally more sprites
    // rather than the same handful spread thin. The floor keeps a small window
    // from looking empty; the ceiling keeps a very large one from thrashing.
    const density = Math.max(
      0.5,
      Math.min(1.25, (window.innerWidth * window.innerHeight) / (1280 * 800)),
    );

    const drops = Array.from(
      { length: Math.max(6, Math.round(rain.count * density)) },
      () => ({
        x: Math.random(),
        y: Math.random(),
        speed: 0.02 + Math.random() * 0.05,
        size: rain.size * (0.55 + Math.random() * 0.75),
        spin: (Math.random() - 0.5) * 1.6,
        angle: Math.random() * Math.PI * 2,
        alpha: 0.16 + Math.random() * 0.26,
      }),
    );

    let last = performance.now();

    const tick = (now: number) => {
      // Delta-timed, so the fall rate is the same on any refresh rate and a
      // window that was hidden does not teleport everything on return.
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;

      context.clearRect(0, 0, canvas.width, canvas.height);

      if (ready) {
        for (const drop of drops) {
          drop.y += drop.speed * delta;
          drop.angle += drop.spin * delta;

          if (drop.y > 1.15) {
            drop.y = -0.15;
            drop.x = Math.random();
          }

          const size = drop.size * ratio;
          context.save();
          context.globalAlpha = drop.alpha;
          context.translate(drop.x * canvas.width, drop.y * canvas.height);
          context.rotate(drop.angle);
          context.drawImage(sprite, -size / 2, -size / 2, size, size);
          context.restore();
        }
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [rain]);

  if (!rain) return null;

  return <canvas ref={canvasRef} className="theme-rain" aria-hidden="true" />;
};

export default ThemeRain;
