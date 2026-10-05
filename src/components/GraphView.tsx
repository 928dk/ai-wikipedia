import { useRef, useEffect } from 'react';
import { Article } from '../types';

interface GraphNode {
  id: number;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphLink {
  source: number;
  target: number;
}

function computeLinks(articles: Article[]): GraphLink[] {
  const links: GraphLink[] = [];
  const titleWords = articles.map(a => new Set(a.title.toLowerCase().split(/\s+/).filter(w => w.length > 3)));
  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      let shared = 0;
      for (const w of titleWords[i]) if (titleWords[j].has(w)) shared++;
      if (shared > 0 || articles[i].content.toLowerCase().includes(articles[j].title.toLowerCase())) {
        links.push({ source: i, target: j });
      }
    }
  }
  return links;
}

export function GraphView({ articles, onSelect }: { articles: Article[]; onSelect: (a: Article) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || articles.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;

    const nodes: GraphNode[] = articles.map((a, i) => ({
      id: i, label: a.title,
      x: w * 0.1 + Math.random() * w * 0.8,
      y: h * 0.1 + Math.random() * h * 0.8,
      vx: 0, vy: 0,
    }));

    const links = computeLinks(articles);
    let running = true;
    let frame = 0;
    let hoveredIdx: number | null = null;

    const simulate = () => {
      if (!running) return;
      frame++;

      const centerX = w / 2, centerY = h / 2;
      const repulsion = 80000;
      const attraction = 0.005;
      const damping = 0.85;
      const maxSpeed = 8;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        let fx = (centerX - n.x) * 0.001;
        let fy = (centerY - n.y) * 0.001;

        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = n.x - nodes[j].x;
          const dy = n.y - nodes[j].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          fx += (dx / dist) * repulsion / (dist * dist);
          fy += (dy / dist) * repulsion / (dist * dist);
        }

        n.vx = (n.vx + fx) * damping;
        n.vy = (n.vy + fy) * damping;
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > maxSpeed) { n.vx = (n.vx / speed) * maxSpeed; n.vy = (n.vy / speed) * maxSpeed; }
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(20, Math.min(w - 20, n.x));
        n.y = Math.max(20, Math.min(h - 20, n.y));
      }

      for (const link of links) {
        const s = nodes[link.source], t = nodes[link.target];
        const dx = t.x - s.x, dy = t.y - s.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (dist - 150) * attraction;
        const fxd = (dx / dist) * force;
        const fyd = (dy / dist) * force;
        s.vx += fxd; s.vy += fyd;
        t.vx -= fxd; t.vy -= fyd;
      }

      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(100, 100, 150, 0.15)';
      ctx.lineWidth = 1;
      for (const link of links) {
        ctx.beginPath();
        ctx.moveTo(nodes[link.source].x, nodes[link.source].y);
        ctx.lineTo(nodes[link.target].x, nodes[link.target].y);
        ctx.stroke();
      }

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        ctx.beginPath();
        ctx.arc(n.x, n.y, hoveredIdx === i ? 8 : 6, 0, Math.PI * 2);
        ctx.fillStyle = hoveredIdx === i ? '#a78bfa' : '#6366f1';
        ctx.fill();
        if (hoveredIdx === i) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '24px sans-serif';
          ctx.fillText(n.label, n.x + 14, n.y + 8);
        }
      }

      if (frame < 200) requestAnimationFrame(simulate);
    };

    simulate();

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * 2;
      const my = (e.clientY - rect.top) * 2;
      let found: number | null = null;
      for (let i = 0; i < nodes.length; i++) {
        const dx = mx - nodes[i].x, dy = my - nodes[i].y;
        if (dx * dx + dy * dy < 400) { found = i; break; }
      }
      hoveredIdx = found;
      canvas.style.cursor = found !== null ? 'pointer' : 'default';
    };

    const handleClick = (_e: MouseEvent) => {
      if (hoveredIdx === null) return;
      onSelect(articles[hoveredIdx]);
    };

    canvas.addEventListener('mousemove', handleMouse);
    canvas.addEventListener('click', handleClick);

    return () => { running = false; canvas.removeEventListener('mousemove', handleMouse); canvas.removeEventListener('click', handleClick); };
  }, [articles, onSelect]);

  if (articles.length === 0) return <div className="text-gray-500 text-center py-8">No articles to graph.</div>;

  return <canvas ref={canvasRef} className="w-full h-[500px] rounded-lg cursor-pointer bg-gray-900" />;
}
