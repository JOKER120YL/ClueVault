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
  const [disciplineOptions, setDisciplineOptions] = useState([]);
  const [pendingDrop, setPendingDrop] = useState(null);

  useEffect(() => {
    let mounted = true;
    window.bugHelperApi.getWidgetState().then((state) => {
      if (mounted) {
        setWidgetState(state);
      }
    });
    window.bugHelperApi.getWidgetBootstrap().then((state) => {
      if (mounted) {
        setDisciplineOptions(state.disciplineOptions || []);
      }
    });

    const unsubscribe = window.bugHelperApi.onWidgetStateUpdated((state) => {
      setWidgetState(state);
    });
    const unsubscribeDropReady = window.bugHelperApi.onWidgetDropReady((payload) => {
      setPendingDrop(payload);
    });
    const unsubscribeDropCleared = window.bugHelperApi.onWidgetDropCleared(() => {
      setPendingDrop(null);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
      unsubscribeDropReady?.();
      unsubscribeDropCleared?.();
    };
  }, []);

  async function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    const paths = window.bugHelperApi.extractPathsFromFiles(event.dataTransfer.files);
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
      title={widgetState.hint}
    >
      <div className="floating-aura" />
      <div className={`floating-core ${widgetState.currentAvatar}`}>
        <img
          src={widgetState.currentAvatar === "bee" ? "mascots/frogdi-confused-final.png" : "mascots/ebee-angry-final.png"}
          alt={widgetState.currentAvatar === "bee" ? "蜂哥悬浮窗" : "蛙弟悬浮窗"}
        />
      </div>
      <div className="floating-tip">{dragging ? "松手快速反馈" : "点击打开 / 拖入文件"}</div>
      <div className={`floating-badge ${widgetState.currentAvatar}`}>
        <strong>{widgetState.todayCount}</strong>
        <span>/ {widgetState.threshold}</span>
      </div>
      {pendingDrop ? (
        <div
          className="floating-menu"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <strong>选择专业</strong>
          <div className="floating-menu-chips">
            {disciplineOptions.map((item) => (
              <button
                key={item.id}
                className="floating-chip"
                onClick={(event) => {
                  event.stopPropagation();
                  window.bugHelperApi.confirmWidgetDrop(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default FloatingWidget;
