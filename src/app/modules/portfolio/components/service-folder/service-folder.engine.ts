/** Lightweight DOM adaptation of the supplied FolderFloat interaction. */
interface Pill {
  element: HTMLButtonElement;
  height: number;
  phase: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  width: number;
  x: number;
  y: number;
}

export interface FolderMotionHandle {
  destroy(): void;
  isDragging(): boolean;
}

const jitter = (index: number) => {
  const value = Math.sin(index * 12.9898 + 4.1414) * 43758.5453;
  return value - Math.floor(value);
};

export function mountFolderMotion(
  root: HTMLElement,
  onLeave: () => void,
): FolderMotionHandle {
  const anchor = root.querySelector<HTMLElement>('.folder-float__items')!;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  let pills: Pill[] = [];
  let frame = 0;
  let layoutFrame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let alive = true;
  let visible = true;
  let last = 0;
  let started = 0;
  let halfWidth = 0;
  let top = 0;
  let drag:
    | {
        id: number;
        index: number;
        moved: boolean;
        sx: number;
        sy: number;
        dx: number;
        dy: number;
      }
    | undefined;
  let suppressed: HTMLElement | undefined;

  const stop = () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    frame = 0;
    root.removeAttribute('data-live');
  };
  const paint = () => {
    for (const pill of pills) {
      pill.element.style.setProperty('--x', `${pill.x.toFixed(1)}px`);
      pill.element.style.setProperty(
        '--y',
        `${(pill.y - pill.height / 2).toFixed(1)}px`,
      );
    }
  };
  const tick = (now: number) => {
    frame = 0;
    if (
      !alive ||
      !visible ||
      document.hidden ||
      !root.hasAttribute('data-open') ||
      motion.matches
    )
      return;
    const dt = Math.min(2, (now - last) / (1000 / 60));
    last = now;
    const time = (now - started) / 1000;
    pills.forEach((pill, index) => {
      if (drag?.index === index) return;
      const targetX = pill.targetX + Math.sin(time * 0.9 + pill.phase) * 7;
      const targetY = pill.targetY + Math.cos(time * 1.3 + pill.phase) * 4;
      pill.vx =
        (pill.vx + (targetX - pill.x) * 0.018 * dt) * Math.pow(0.86, dt);
      pill.vy =
        (pill.vy + (targetY - pill.y) * 0.018 * dt) * Math.pow(0.86, dt);
      pill.x += pill.vx * dt;
      pill.y += pill.vy * dt;
    });
    // Six visible items keep collision work small and prevent crowded folders.
    for (let i = 0; i < pills.length; i++)
      for (let j = i + 1; j < pills.length; j++) {
        const a = pills[i],
          b = pills[j];
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const ox = (a.width + b.width) / 2 + 8 - Math.abs(dx);
        const oy = (a.height + b.height) / 2 + 8 - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        const factorA = drag?.index === i ? 0 : drag?.index === j ? 1 : 0.5;
        const factorB = drag?.index === j ? 0 : drag?.index === i ? 1 : 0.5;
        if (ox < oy) {
          const push = (dx >= 0 ? 1 : -1) * ox;
          a.x -= push * factorA;
          b.x += push * factorB;
        } else {
          const push = (dy >= 0 ? 1 : -1) * oy;
          a.y -= push * factorA;
          b.y += push * factorB;
        }
      }
    for (const pill of pills) {
      pill.x = Math.max(
        -halfWidth + pill.width / 2,
        Math.min(halfWidth - pill.width / 2, pill.x),
      );
      pill.y = Math.max(
        top + pill.height / 2,
        Math.min(-18 - pill.height / 2, pill.y),
      );
    }
    paint();
    frame = requestAnimationFrame(tick);
  };
  const start = () => {
    if (
      !alive ||
      !visible ||
      motion.matches ||
      !pointer.matches ||
      document.hidden ||
      !root.hasAttribute('data-open')
    )
      return;
    root.setAttribute('data-live', '');
    started = last = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const layout = () => {
    layoutFrame = 0;
    stop();
    if (!alive) return;
    const width = Math.max(200, Math.min(500, root.clientWidth - 32));
    root.style.setProperty(
      '--ff-item-max',
      `${Math.min(190, (width - 12) / 2)}px`,
    );
    const elements = [
      ...root.querySelectorAll<HTMLButtonElement>('.folder-float__item'),
    ];
    const sizes = elements.map((element) => ({
      height: element.offsetHeight,
      width: element.offsetWidth,
    }));
    const rows: { indices: number[]; width: number }[] = [];
    for (let i = 0; i < elements.length; i++) {
      let row = rows.at(-1);
      if (!row || row.width + 12 + sizes[i].width > width) {
        row = { indices: [], width: 0 };
        rows.push(row);
      }
      row.width += (row.indices.length ? 12 : 0) + sizes[i].width;
      row.indices.push(i);
    }
    pills = [];
    rows.forEach((row, rowIndex) => {
      let x = -row.width / 2;
      for (const index of row.indices) {
        const { height, width: pillWidth } = sizes[index];
        const phase = jitter(index);
        const targetX = x + pillWidth / 2;
        const targetY = -26 - height / 2 - rowIndex * 54 - phase * 4;
        const element = elements[index];
        element.style.setProperty(
          '--r',
          `${(8 * (phase * 2 - 1)).toFixed(2)}deg`,
        );
        pills[index] = {
          element,
          height,
          phase: phase * Math.PI * 2,
          targetX,
          targetY,
          vx: 0,
          vy: 0,
          width: pillWidth,
          x: targetX,
          y: targetY,
        };
        x += pillWidth + 12;
      }
    });
    const rootRect = root.getBoundingClientRect();
    halfWidth = root.clientWidth / 2 - 10;
    top = rootRect.top - anchor.getBoundingClientRect().top + 8;
    paint();
    if (root.hasAttribute('data-open'))
      timer = setTimeout(start, 600 + Math.max(0, pills.length - 1) * 45);
  };
  const schedule = () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(layout);
  };
  const down = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      event.pointerType !== 'mouse' ||
      !root.hasAttribute('data-open') ||
      motion.matches
    )
      return;
    const element = (event.target as Element).closest<HTMLButtonElement>(
      '.folder-float__item',
    );
    const index = pills.findIndex((pill) => pill.element === element);
    if (index < 0 || !element) return;
    const rect = anchor.getBoundingClientRect();
    drag = {
      dx: pills[index].x - (event.clientX - rect.left),
      dy: pills[index].y - (event.clientY - rect.top),
      id: event.pointerId,
      index,
      moved: false,
      sx: event.clientX,
      sy: event.clientY,
    };
    element.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (
      Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) < 4 &&
      !drag.moved
    )
      return;
    drag.moved = true;
    const pill = pills[drag.index];
    const rect = anchor.getBoundingClientRect();
    pill.element.setAttribute('data-drag', '');
    pill.x = Math.max(
      -halfWidth + pill.width / 2,
      Math.min(halfWidth - pill.width / 2, event.clientX - rect.left + drag.dx),
    );
    pill.y = Math.max(
      top + pill.height / 2,
      Math.min(-18 - pill.height / 2, event.clientY - rect.top + drag.dy),
    );
    pill.vx = pill.vy = 0;
    paint();
    event.preventDefault();
  };
  const up = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    const pill = pills[drag.index];
    if (drag.moved && event.type === 'pointerup') suppressed = pill.element;
    pill.element.removeAttribute('data-drag');
    if (pill.element.hasPointerCapture(event.pointerId))
      pill.element.releasePointerCapture(event.pointerId);
    drag = undefined;
  };
  const click = (event: MouseEvent) => {
    const element = (event.target as Element).closest('.folder-float__item');
    if (suppressed && element === suppressed && event.detail !== 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    suppressed = undefined;
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(root);
  const changes = new MutationObserver(schedule);
  changes.observe(root, {
    attributeFilter: ['data-open'],
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
    else {
      stop();
      onLeave();
    }
  });
  intersection.observe(root);
  const visibility = () => (document.hidden ? stop() : schedule());
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', schedule);
  pointer.addEventListener('change', schedule);
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('click', click, true);
  void document.fonts?.ready.then(() => {
    if (alive) schedule();
  });
  schedule();
  return {
    destroy: () => {
      alive = false;
      stop();
      cancelAnimationFrame(layoutFrame);
      resize.disconnect();
      changes.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', schedule);
      pointer.removeEventListener('change', schedule);
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up);
      root.removeEventListener('click', click, true);
    },
    isDragging: () => Boolean(drag),
  };
}
