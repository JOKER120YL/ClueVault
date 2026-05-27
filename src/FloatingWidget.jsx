import { useEffect, useState } from "react";

function FloatingWidget() {
  const [widgetState, setWidgetState] = useState({
    todayCount: 0,
    threshold: 1,
    currentAvatar: "frog",
    hint: ""
  });
  const [dragging, setDragging] = useState(false);
  const [pointerState, setPointerState] = useState(null);

  useEffect(() => {
    let mounted = true;
    window.bugHelperApi.getWidgetState().then((state) => {
      if (mounted) {
        setWidgetState(state);
      }
    });

    const unsubscribe = window.bugHelperApi.onWidgetStateUpdated((state) => {
      setWidgetState(state);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  async function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    const paths = Array.from(event.dataTransfer.files || []).map((file) => file.path).filter(Boolean);
    if (!paths.length) {
      return;
    }

    await window.bugHelperApi.dropFilesToWidget(paths);
  }

  async function handlePointerDown(event) {
    setPointerState({
      startX: event.screenX,
      startY: event.screenY,
      moved: false
    });

    await window.bugHelperApi.startWidgetDrag({
      x: event.screenX,
      y: event.screenY
    });
  }

  async function handlePointerMove(event) {
    if (!pointerState) {
      return;
    }

    const moved =
      Math.abs(event.screenX - pointerState.startX) > 4 || Math.abs(event.screenY - pointerState.startY) > 4;
    if (moved && !pointerState.moved) {
      setPointerState((current) => (current ? { ...current, moved: true } : current));
    }

    await window.bugHelperApi.moveWidgetDrag({
      x: event.screenX,
      y: event.screenY
    });
  }

  async function handlePointerUp() {
    const wasClick = pointerState && !pointerState.moved;
    setPointerState(null);
    await window.bugHelperApi.endWidgetDrag();
    if (wasClick) {
      await window.bugHelperApi.openMainFromWidget();
    }
  }

  return (
    <div
      className={`floating-root ${dragging ? "dragging" : ""} ${widgetState.currentAvatar}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title={widgetState.hint}
    >
      <div className="floating-aura" />
      <div
        className={`floating-core ${widgetState.currentAvatar}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!dragging) {
            setDragging(true);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <img
          src={widgetState.currentAvatar === "bee" ? "mascots/ebee-angry-final.png" : "mascots/frogdi-confused-final.png"}
          alt={widgetState.currentAvatar === "bee" ? "蜂哥悬浮窗" : "蛙弟悬浮窗"}
        />
      </div>
      <div className="floating-tip">{dragging ? "松手快速反馈" : "点击打开 / 拖入文件"}</div>
      <div className={`floating-badge ${widgetState.currentAvatar}`}>
        <strong>{widgetState.todayCount}</strong>
        <span>/ {widgetState.threshold}</span>
      </div>
    </div>
  );
}

export default FloatingWidget;
