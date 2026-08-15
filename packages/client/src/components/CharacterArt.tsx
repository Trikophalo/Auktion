import { useEffect, useRef } from 'react';
import type { CharacterPublic } from '@gla/shared';
import { drawPortrait, pixelate } from '../fx/art';

interface Props {
  character: CharacterPublic | undefined;
  accent: string;
  /** 0 = fully revealed, 1 = unrecognisable. */
  pixelLevel?: number;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Draws the portrait on a canvas so the reveal can pixelate it for real.
 * If the character has real artwork, it is used and pixelated identically;
 * a load failure silently falls back to the procedural portrait.
 */
export function CharacterArt({ character, accent, pixelLevel = 0, width = 320, height = 400, className }: Props) {
  const visible = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  // Redraw the source art whenever the character changes.
  useEffect(() => {
    if (!character) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const src = source.current;

    drawPortrait(src, { id: character.id, name: character.name, accent, width, height });

    let cancelled = false;
    if (character.image) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        const ctx = src.getContext('2d');
        if (!ctx) return;
        // Cover-fit the artwork over the procedural backdrop.
        const scale = Math.max((width * dpr) / img.width, (height * dpr) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(img, (width * dpr - w) / 2, (height * dpr - h) / 2, w, h);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        redraw();
      };
      img.src = character.image;
    }

    redraw();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id, accent, width, height]);

  function redraw() {
    const canvas = visible.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    pixelate(source.current, canvas, pixelLevel);
  }

  useEffect(redraw);

  if (!character) return <div className={`art-empty ${className ?? ''}`} />;

  return (
    <canvas
      ref={visible}
      className={`character-art ${className ?? ''}`}
      style={{ aspectRatio: `${width} / ${height}` }}
      aria-label={character.name}
    />
  );
}
