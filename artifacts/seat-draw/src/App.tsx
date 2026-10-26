import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  AlertCircle,
  Check,
  Copy,
  History,
  Info,
  LayoutGrid,
  Printer,
  Save,
  Shuffle,
  TicketCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const HISTORY_STORAGE_KEY = 'jari-bbobgi-draw-history';
const MAX_HISTORY_ITEMS = 10;
const DRAG_HOLD_DELAY = 300;

type Assignment = Array<number | null>;

type DrawRecord = {
  id: string;
  createdAt: string;
  rows: number;
  columns: number;
  participantCount: number;
  excludedNumbers: number[];
  priorityNumbers: number[];
  frontPriority: boolean;
  excludedSeats: number[];
  assignment: Assignment;
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function parseNumberList(value: string, participantCount: number) {
  const tokens = value.split(',').map((token) => token.trim()).filter(Boolean);
  const isValidRange = Number.isInteger(participantCount) && participantCount >= 1;
  const invalid = tokens.filter((token) => {
    if (!/^\d+$/.test(token)) return true;
    const number = Number(token);
    return !isValidRange || number < 1 || number > participantCount;
  });
  const numbers = [...new Set(tokens
    .filter((token) => /^\d+$/.test(token))
    .map(Number)
    .filter((number) => isValidRange && number >= 1 && number <= participantCount))];
  return { invalid, numbers };
}

function readDrawHistory(): DrawRecord[] {
  try {
    const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is DrawRecord => {
      if (!item || typeof item !== 'object') return false;
      const record = item as Partial<DrawRecord>;
      return typeof record.id === 'string'
        && typeof record.createdAt === 'string'
        && Array.isArray(record.assignment)
        && Array.isArray(record.excludedSeats);
    }).slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const adjustedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + adjustedRadius, y);
  context.arcTo(x + width, y, x + width, y + height, adjustedRadius);
  context.arcTo(x + width, y + height, x, y + height, adjustedRadius);
  context.arcTo(x, y + height, x, y, adjustedRadius);
  context.arcTo(x, y, x + width, y, adjustedRadius);
  context.closePath();
}

function Home() {
  const [rows, setRows] = useState('5');
  const [columns, setColumns] = useState('6');
  const [participantCount, setParticipantCount] = useState('30');
  const [excludedText, setExcludedText] = useState('');
  const [frontPriority, setFrontPriority] = useState(true);
  const [priorityText, setPriorityText] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [drawError, setDrawError] = useState('');
  const [excludedSeatNumbers, setExcludedSeatNumbers] = useState<Set<number>>(() => new Set());
  const [history, setHistory] = useState<DrawRecord[]>(readDrawHistory);
  const [draggedSeatIndex, setDraggedSeatIndex] = useState<number | null>(null);
  const [dragOverSeatIndex, setDragOverSeatIndex] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number } | null>(null);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const draggedSeatRef = useRef<number | null>(null);
  const dragOverSeatRef = useRef<number | null>(null);
  const pendingSeatRef = useRef<number | null>(null);
  const dragPressTimerRef = useRef<number | null>(null);
  const pressTargetRef = useRef<HTMLDivElement | null>(null);
  const pressPointerIdRef = useRef<number | null>(null);
  const timeoutIds = useRef<number[]>([]);
  const feedbackTimeoutIds = useRef<number[]>([]);

  const rowCount = Number(rows);
  const columnCount = Number(columns);
  const poolCount = Number(participantCount);
  const validDimensions = Number.isInteger(rowCount) && rowCount >= 1 && rowCount <= 20
    && Number.isInteger(columnCount) && columnCount >= 1 && columnCount <= 20;
  const validPool = Number.isInteger(poolCount) && poolCount >= 1 && poolCount <= 500;
  const seatCount = validDimensions ? rowCount * columnCount : 0;
  const excluded = useMemo(() => parseNumberList(excludedText, poolCount), [excludedText, poolCount]);
  const priority = useMemo(() => parseNumberList(priorityText, poolCount), [priorityText, poolCount]);
  const excludedSet = useMemo(() => new Set(excluded.numbers), [excluded.numbers]);
  const eligibleCount = validPool ? Math.max(0, poolCount - excludedSet.size) : 0;
  const availableSeatIndices = useMemo(
    () => Array.from({ length: seatCount }, (_, index) => index).filter((index) => !excludedSeatNumbers.has(index + 1)),
    [seatCount, excludedSeatNumbers],
  );
  const availableSeatCount = availableSeatIndices.length;
  const actualSeatCount = validDimensions && validPool ? Math.min(availableSeatCount, eligibleCount) : availableSeatCount;
  const omittedSeatCount = validDimensions && validPool ? Math.max(0, availableSeatCount - eligibleCount) : 0;
  const unavailablePriorityNumbers = priority.numbers.filter((number) => excludedSet.has(number));
  const prioritySeatOverflow = priority.numbers.length > actualSeatCount;
  const prioritySet = useMemo(() => new Set(priority.numbers), [priority.numbers]);
  const previewPriorityCount = frontPriority
    && priority.invalid.length === 0
    && unavailablePriorityNumbers.length === 0
    && !prioritySeatOverflow
    ? priority.numbers.length
    : 0;
  const previewPrioritySeatSet = useMemo(
    () => new Set(availableSeatIndices.slice(0, previewPriorityCount).map((index) => index + 1)),
    [availableSeatIndices, previewPriorityCount],
  );

  useEffect(() => () => {
    timeoutIds.current.forEach(window.clearTimeout);
    feedbackTimeoutIds.current.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (draggedSeatIndex === null) return undefined;
    const preventDragScroll = (event: TouchEvent) => event.preventDefault();
    document.addEventListener('touchmove', preventDragScroll, { passive: false });
    document.body.classList.add('is-seat-dragging');
    return () => {
      document.removeEventListener('touchmove', preventDragScroll);
      document.body.classList.remove('is-seat-dragging');
    };
  }, [draggedSeatIndex]);

  const cancelCountdown = () => {
    timeoutIds.current.forEach(window.clearTimeout);
    timeoutIds.current = [];
  };

  const saveRecord = (nextAssignment: Assignment, recordId?: string) => {
    const record: DrawRecord = {
      id: recordId ?? `${Date.now()}`,
      createdAt: new Date().toISOString(),
      rows: rowCount,
      columns: columnCount,
      participantCount: poolCount,
      excludedNumbers: excluded.numbers,
      priorityNumbers: priority.numbers,
      frontPriority,
      excludedSeats: [...excludedSeatNumbers].sort((a, b) => a - b),
      assignment: nextAssignment,
    };
    const nextHistory = recordId
      ? history.map((item) => item.id === recordId ? record : item)
      : [record, ...history].slice(0, MAX_HISTORY_ITEMS);
    setHistory(nextHistory);
    setActiveRecordId(record.id);
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  };

  const toggleExcludedSeat = (seatNumber: number) => {
    if (countdown !== null || assignment !== null) return;
    setExcludedSeatNumbers((current) => {
      const next = new Set(current);
      if (next.has(seatNumber)) next.delete(seatNumber);
      else next.add(seatNumber);
      return next;
    });
    setDrawError('');
  };

  const swapSeats = (sourceIndex: number, targetIndex: number) => {
    if (!assignment || sourceIndex === targetIndex) return;
    if (assignment[sourceIndex] === null || assignment[targetIndex] === null) return;
    const nextAssignment = [...assignment];
    [nextAssignment[sourceIndex], nextAssignment[targetIndex]] = [nextAssignment[targetIndex], nextAssignment[sourceIndex]];
    setAssignment(nextAssignment);
    saveRecord(nextAssignment, activeRecordId ?? undefined);
  };

  const startSeatPointerDrag = (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
    if (!assignment || assignment[index] === null) return;
    pendingSeatRef.current = index;
    pressTargetRef.current = event.currentTarget;
    pressPointerIdRef.current = event.pointerId;
    setDragOrigin({ x: event.clientX, y: event.clientY });
    setDragPosition({ x: event.clientX, y: event.clientY });
    dragPressTimerRef.current = window.setTimeout(() => {
      if (pendingSeatRef.current !== index) return;
      pressTargetRef.current?.setPointerCapture(pressPointerIdRef.current ?? event.pointerId);
      draggedSeatRef.current = index;
      dragOverSeatRef.current = index;
      setDraggedSeatIndex(index);
      setDragOverSeatIndex(index);
    }, DRAG_HOLD_DELAY);
  };

  const moveSeatPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pendingSeatRef.current === null && draggedSeatRef.current === null) return;
    if (draggedSeatRef.current === null) return;
    event.preventDefault();
    setDragPosition({ x: event.clientX, y: event.clientY });
    const sourceIndex = draggedSeatRef.current;
    const seatElement = document.elementsFromPoint(event.clientX, event.clientY)
      .map((element) => element instanceof HTMLElement
        ? element.closest<HTMLElement>('[data-seat-index]')
        : null)
      .find((element) => element && Number(element.dataset.seatIndex) !== sourceIndex);
    const nextIndex = seatElement ? Number(seatElement.dataset.seatIndex) : null;
    if (nextIndex !== null && Number.isInteger(nextIndex)) {
      dragOverSeatRef.current = nextIndex;
      setDragOverSeatIndex(nextIndex);
    }
  };

  const finishSeatPointerDrag = () => {
    if (dragPressTimerRef.current !== null) {
      window.clearTimeout(dragPressTimerRef.current);
      dragPressTimerRef.current = null;
    }
    const sourceIndex = draggedSeatRef.current;
    const targetIndex = dragOverSeatRef.current;
    if (sourceIndex !== null && targetIndex !== null) swapSeats(sourceIndex, targetIndex);
    pendingSeatRef.current = null;
    pressTargetRef.current = null;
    pressPointerIdRef.current = null;
    draggedSeatRef.current = null;
    dragOverSeatRef.current = null;
    setDraggedSeatIndex(null);
    setDragOverSeatIndex(null);
    setDragPosition(null);
    setDragOrigin(null);
  };

  const loadRecord = (record: DrawRecord) => {
    setRows(String(record.rows));
    setColumns(String(record.columns));
    setParticipantCount(String(record.participantCount));
    setExcludedText(record.excludedNumbers.join(', '));
    setPriorityText(record.priorityNumbers.join(', '));
    setFrontPriority(record.frontPriority);
    setExcludedSeatNumbers(new Set(record.excludedSeats));
    setAssignment(record.assignment);
    setActiveRecordId(record.id);
    setDrawError('');
  };

  const deleteRecord = (recordId: string) => {
    const nextHistory = history.filter((record) => record.id !== recordId);
    setHistory(nextHistory);
    if (activeRecordId === recordId) setActiveRecordId(null);
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    setActiveRecordId(null);
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  const formatResult = () => {
    if (!assignment) return '';
    const lines = Array.from({ length: rowCount }, (_, rowIndex) => {
      const row = assignment.slice(rowIndex * columnCount, (rowIndex + 1) * columnCount)
        .map((number, columnIndex) => {
          const seatNumber = rowIndex * columnCount + columnIndex + 1;
          if (excludedSeatNumbers.has(seatNumber)) return '제외';
          return number === null ? '미배정' : String(number);
        });
      return `${rowIndex + 1}행: ${row.join(', ')}`;
    });
    const notes = [
      excludedSummary.length > 0 ? `제외 참가자: ${excludedSummary.join(', ')}` : '',
      excludedSeatSummary.length > 0 ? `제외 좌석: ${excludedSeatSummary.join(', ')}` : '',
    ].filter(Boolean);
    return ['자리 배치 결과', '', ...lines, ...(notes.length > 0 ? ['', ...notes] : [])].join('\n');
  };

  const copyResult = async () => {
    if (!assignment) return;
    try {
      await navigator.clipboard.writeText(formatResult());
      setCopyFeedback(true);
      feedbackTimeoutIds.current.push(window.setTimeout(() => setCopyFeedback(false), 1800));
    } catch {
      setDrawError('결과를 복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요.');
    }
  };

  const saveResultImage = async () => {
    if (!assignment) return;
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    const exportScale = 2;
    const logicalWidth = 1600;
    const logicalHeight = 900;
    canvas.width = logicalWidth * exportScale;
    canvas.height = logicalHeight * exportScale;
    const context = canvas.getContext('2d');
    if (!context) {
      setDrawError('이미지를 만들지 못했어요. 브라우저를 확인해 주세요.');
      return;
    }
    context.scale(exportScale, exportScale);

    const padding = 72;
    context.fillStyle = '#f8f5eb';
    context.fillRect(0, 0, logicalWidth, logicalHeight);
    context.fillStyle = '#25473d';
    context.font = '700 42px "Gowun Dodum", sans-serif';
    context.fillText('자리 배치 결과', padding, 82);
    context.fillStyle = '#718078';
    context.font = '500 18px "DM Sans", sans-serif';
    context.fillText(`${rowCount}행 x ${columnCount}열 · ${seats.length}석 배정`, padding, 116);
    context.textAlign = 'right';
    context.fillText(new Date().toLocaleString('ko-KR'), logicalWidth - padding, 82);
    context.textAlign = 'left';

    const boardWidth = Math.min(560, canvas.width - padding * 2);
    const boardX = (canvas.width - boardWidth) / 2;
    drawRoundedRect(context, boardX, 155, boardWidth, 46, 8);
    context.fillStyle = '#23584c';
    context.fill();
    context.fillStyle = '#f6f2df';
    context.font = '700 20px "Gowun Dodum", sans-serif';
    context.textAlign = 'center';
    context.fillText('칠판', canvas.width / 2, 185);
    context.textAlign = 'left';

    const gridTop = 245;
    const gridLeft = padding;
    const gridWidth = logicalWidth - padding * 2;
    const gridGap = 12;
    const seatWidth = (gridWidth - gridGap * Math.max(columnCount - 1, 0)) / columnCount;
    const seatHeight = Math.min(92, (logicalHeight - gridTop - 92 - gridGap * Math.max(rowCount - 1, 0)) / rowCount);
    assignment.forEach((number, index) => {
      const rowIndex = Math.floor(index / columnCount);
      const columnIndex = index % columnCount;
      const seatNumber = index + 1;
      const x = gridLeft + columnIndex * (seatWidth + gridGap);
      const y = gridTop + rowIndex * (seatHeight + gridGap);
      const isExcluded = excludedSeatNumbers.has(seatNumber);
      const isPriority = number !== null && frontPriority && prioritySet.has(number);
      drawRoundedRect(context, x, y, seatWidth, seatHeight, 12);
      context.fillStyle = isExcluded ? '#fbefeb' : isPriority ? '#f5d6bd' : number === null ? '#f0efe8' : '#ffffff';
      context.fill();
      context.strokeStyle = isExcluded ? '#d28a7b' : isPriority ? '#c87950' : '#d9dfd2';
      context.lineWidth = 2;
      context.stroke();
      context.textAlign = 'center';
      context.font = '500 28px "DM Mono", monospace';
      context.fillStyle = isExcluded ? '#b95c4d' : isPriority ? '#89472e' : number === null ? '#a5a69d' : '#28584b';
      context.fillText(isExcluded ? 'X' : number === null ? '-' : String(number), x + seatWidth / 2, y + seatHeight / 2 + 10);
    });
    context.textAlign = 'left';
    context.fillStyle = '#77847a';
    context.font = '500 16px "DM Sans", sans-serif';
    const footer = [
      excludedSummary.length > 0 ? `제외 참가자 ${excludedSummary.length}명` : '',
      excludedSeatSummary.length > 0 ? `제외 좌석 ${excludedSeatSummary.length}개` : '',
    ].filter(Boolean).join(' · ');
    if (footer) context.fillText(footer, padding, logicalHeight - 38);

    canvas.toBlob((blob) => {
      if (!blob) {
        setDrawError('이미지를 저장하지 못했어요. 브라우저를 확인해 주세요.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `자리-배치-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setSaveFeedback(true);
      feedbackTimeoutIds.current.push(window.setTimeout(() => setSaveFeedback(false), 1800));
    }, 'image/png');
  };

  const generate = () => {
    setDrawError('');
    if (countdown !== null) return;
    if (!validDimensions) {
      setDrawError('행과 열은 1부터 20 사이의 정수로 입력해 주세요.');
      setAssignment(null);
      return;
    }
    if (!validPool) {
      setDrawError('참가자 번호는 1부터 500 사이의 정수로 입력해 주세요.');
      setAssignment(null);
      return;
    }
    if (excluded.invalid.length > 0) {
      setDrawError('제외 번호를 확인해 주세요. 참가자 범위 안의 정수만 입력할 수 있어요.');
      setAssignment(null);
      return;
    }
    if (eligibleCount === 0 || availableSeatCount === 0) {
      setDrawError('배정 가능한 참가자가 없어요. 제외 번호를 확인해 주세요.');
      setAssignment(null);
      return;
    }
    if (frontPriority && priority.invalid.length > 0) {
      setDrawError('앞자리 우선 번호는 참가자 범위 안의 정수로 입력해 주세요.');
      setAssignment(null);
      return;
    }
    if (frontPriority && unavailablePriorityNumbers.length > 0) {
      setDrawError(`제외 번호에 포함된 ${unavailablePriorityNumbers.join(', ')}번은 앞자리 우선 번호로 지정할 수 없어요.`);
      setAssignment(null);
      return;
    }
    if (frontPriority && prioritySeatOverflow) {
      setDrawError(`앞자리 우선 번호가 배정 가능한 좌석 ${actualSeatCount}개보다 많아요.`);
      setAssignment(null);
      return;
    }

    cancelCountdown();
    setAssignment(null);
    setCountdown(3);
    timeoutIds.current = [
      window.setTimeout(() => setCountdown(2), 1000),
      window.setTimeout(() => setCountdown(1), 2000),
      window.setTimeout(() => {
        const pool = Array.from({ length: poolCount }, (_, index) => index + 1)
          .filter((number) => !excludedSet.has(number));
        const seatsToFill = Math.min(availableSeatCount, pool.length);
        const prioritized = frontPriority ? shuffle(priority.numbers) : [];
        const prioritizedSet = new Set(prioritized);
        const remaining = shuffle(pool.filter((number) => !prioritizedSet.has(number)))
          .slice(0, seatsToFill - prioritized.length);
        const selected = [...prioritized, ...remaining];
        const ordered = frontPriority ? selected : shuffle(selected);
        const nextAssignment: Assignment = Array.from({ length: seatCount }, (_, index) => {
          if (excludedSeatNumbers.has(index + 1)) return null;
          const seatPosition = availableSeatIndices.indexOf(index);
          return seatPosition < ordered.length ? ordered[seatPosition] : null;
        });
        setAssignment(nextAssignment);
        saveRecord(nextAssignment);
        setCountdown(null);
        setDrawError('');
        timeoutIds.current = [];
      }, 3000),
    ];
  };

  const isCounting = countdown !== null;
  const seats = assignment?.filter((number): number is number => number !== null) ?? [];
  const excludedSummary = [...excludedSet].sort((a, b) => a - b);
  const excludedSeatSummary = [...excludedSeatNumbers].sort((a, b) => a - b);

  return (
    <main className="page-shell">
      <div className="page-wrap">
        <header className="masthead">
          <div className="brand" aria-label="자리 뽑기">
            <span className="brand-mark"><TicketCheck size={21} strokeWidth={1.8} /></span>
            <h1 className="brand-name" id="page-title">자리 뽑기</h1>
          </div>
        </header>

        <div className="workspace">
          <section className="panel setup-panel" aria-labelledby="setup-title">
            <div className="panel-title-row">
              <h2 className="panel-title" id="setup-title"><LayoutGrid size={18} /> 배정 조건</h2>
            </div>

            <section className="settings-group" aria-labelledby="basic-settings-title">
              <h3 className="settings-group-title" id="basic-settings-title">기본 배정</h3>
              <div className="field-group">
              <div className="field-label"><label htmlFor="rows">좌석 배열</label></div>
              <div className="dimensions">
                <div className="number-wrap">
                  <input className="number-input" id="rows" data-testid="input-rows" type="number" min="1" max="20" step="1" value={rows} onChange={(event) => { setRows(event.target.value); setAssignment(null); setDrawError(''); }} aria-label="행 수" disabled={isCounting} />
                  <span className="number-suffix">행</span>
                </div>
                <div className="number-wrap">
                  <input className="number-input" id="columns" data-testid="input-columns" type="number" min="1" max="20" step="1" value={columns} onChange={(event) => { setColumns(event.target.value); setAssignment(null); setDrawError(''); }} aria-label="열 수" disabled={isCounting} />
                  <span className="number-suffix">열</span>
                </div>
              </div>
              </div>

              <div className="field-group">
              <div className="field-label"><label htmlFor="participant-count">참가자 수</label></div>
              <div className="number-wrap">
                <input className="number-input" id="participant-count" data-testid="input-participant-count" type="number" min="1" max="500" step="1" value={participantCount} onChange={(event) => { setParticipantCount(event.target.value); setAssignment(null); setDrawError(''); }} aria-describedby="pool-helper" disabled={isCounting} />
                <span className="number-suffix">명</span>
              </div>
              <p className="helper" id="pool-helper">번호는 1부터 참가자 수까지 사용합니다.</p>
              </div>

              <div className="pool-hint" data-testid="text-eligible-count">
              <Check size={14} />
              <span>배정 가능</span>
              <strong>{Number.isFinite(eligibleCount) ? eligibleCount : 0}명</strong>
              <span>· 좌석 {actualSeatCount}개</span>
              </div>
            </section>

            <section className="settings-group" aria-labelledby="excluded-settings-title">
              <h3 className="settings-group-title" id="excluded-settings-title">제외 설정</h3>
              <div className="field-group">
              <div className="field-label"><label htmlFor="excluded-numbers">제외 번호</label></div>
              <input
                className="exclude-input"
                id="excluded-numbers"
                data-testid="input-excluded-numbers"
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="예: 3, 8, 14"
                value={excludedText}
                onChange={(event) => { setExcludedText(event.target.value); setAssignment(null); setDrawError(''); }}
                disabled={isCounting}
                aria-invalid={excluded.invalid.length > 0}
                aria-describedby="excluded-helper"
              />
              {excluded.invalid.length > 0 && (
                <div className="validation-message" role="alert" data-testid="status-excluded-validation">
                  <AlertCircle size={13} />
                  <span>{excluded.invalid.join(', ')}은(는) 1부터 {Number.isFinite(poolCount) ? poolCount : 0} 사이의 정수가 아니에요.</span>
                </div>
              )}
              <p className="helper" id="excluded-helper">쉼표로 구분해 입력해요. 중복 번호는 한 번만 제외됩니다.</p>
              </div>
              <p className="settings-summary">제외 좌석 {excludedSeatSummary.length}개 · 미리보기에서 좌석을 누르면 지정됩니다.</p>
            </section>

            <section className="settings-group priority-settings" aria-labelledby="priority-settings-title">
              <h3 className="settings-group-title" id="priority-settings-title">우선 배정</h3>
              <label className="priority-box" htmlFor="front-priority">
                <input id="front-priority" data-testid="toggle-front-priority" type="checkbox" checked={frontPriority} onChange={(event) => { setFrontPriority(event.target.checked); setAssignment(null); setDrawError(''); }} disabled={isCounting} />
                <span className="switch" aria-hidden="true" />
                <span>
                  <span className="priority-copy">앞자리 우선</span>
                </span>
              </label>

              {frontPriority && (
                <div className="priority-number-group">
                  <div className="field-label"><label htmlFor="priority-numbers">앞자리 우선 번호</label></div>
                  <input
                    className="exclude-input"
                    id="priority-numbers"
                    data-testid="input-priority-numbers"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    placeholder="예: 2, 7, 12"
                    value={priorityText}
                    onChange={(event) => { setPriorityText(event.target.value); setAssignment(null); setDrawError(''); }}
                    disabled={isCounting}
                    aria-invalid={priority.invalid.length > 0 || unavailablePriorityNumbers.length > 0 || prioritySeatOverflow}
                    aria-describedby="priority-helper"
                  />
                  {priority.invalid.length > 0 && (
                    <div className="validation-message" role="alert" data-testid="status-priority-validation">
                      <AlertCircle size={13} />
                      <span>{priority.invalid.join(', ')}은(는) 1부터 {validPool ? poolCount : 500} 사이의 정수가 아니에요.</span>
                    </div>
                  )}
                  {unavailablePriorityNumbers.length > 0 && (
                    <div className="validation-message" role="alert" data-testid="status-priority-excluded">
                      <AlertCircle size={13} />
                      <span>제외 번호에 포함된 {unavailablePriorityNumbers.join(', ')}번은 앞자리 우선 번호로 사용할 수 없어요.</span>
                    </div>
                  )}
                  {prioritySeatOverflow && (
                    <div className="validation-message" role="alert" data-testid="status-priority-capacity">
                      <AlertCircle size={13} />
                      <span>앞자리 우선 번호가 배정 가능한 좌석 {actualSeatCount}개보다 많아요.</span>
                    </div>
                  )}
                  <p className="helper" id="priority-helper">지정한 번호는 무작위로 앞자리에 배정됩니다.</p>
                </div>
              )}
            </section>

            <section className="history-section" aria-labelledby="history-title">
              <div className="history-heading">
                <h3 className="history-title" id="history-title"><History size={15} /> 이전 추첨</h3>
                <div className="history-actions">
                  <span className="history-count">{history.length}/{MAX_HISTORY_ITEMS}</span>
                  <button className="history-clear" type="button" onClick={clearHistory} disabled={history.length === 0}>
                    <Trash2 size={12} /> 전체 삭제
                  </button>
                </div>
              </div>
              {history.length > 0 ? (
                <div className="history-list">
                  {history.map((record) => (
                    <div className="history-item" key={record.id}>
                      <button className="history-load" type="button" onClick={() => loadRecord(record)}>
                        <strong>{record.rows} x {record.columns} · {record.assignment.filter((number) => number !== null).length}석</strong>
                        <span>{new Date(record.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </button>
                      <button className="history-delete" type="button" onClick={() => deleteRecord(record.id)} aria-label="이전 추첨 기록 삭제" title="기록 삭제">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="history-empty">추첨을 완료하면 최근 결과가 저장됩니다.</p>
              )}
            </section>

            <button className="primary-button" type="button" data-testid="button-generate" onClick={generate} disabled={isCounting}>
              {isCounting ? <><span className="button-count">{countdown}</span>초</> : <><Shuffle size={16} />{assignment ? '다시 뽑기' : '추첨하기'}</>}
            </button>
          </section>

          <section className="panel result-panel" aria-labelledby="result-title">
            <div className="result-heading">
              <div>
                <h2 className="result-title" id="result-title">{assignment ? '추첨 결과' : '자리 미리보기'}</h2>
                {assignment && <p className="result-subtitle">배정 결과는 자동 저장됩니다.</p>}
              </div>
              <div className="result-heading-actions">
                <div className="result-count" data-testid="text-seat-count"><LayoutGrid size={13} /><b>{assignment ? seats.length : actualSeatCount}</b>석</div>
                {assignment && (
                  <div className="result-actions" aria-label="추첨 결과 작업">
                    <button className="result-action" type="button" onClick={saveResultImage} title="결과 이미지 저장">
                      <Save size={14} /> <span>{saveFeedback ? '저장됨' : '이미지 저장'}</span>
                    </button>
                    <button className="result-action" type="button" onClick={copyResult} title="결과 복사">
                      <Copy size={14} /> <span>{copyFeedback ? '복사됨' : '복사'}</span>
                    </button>
                    <button className="result-action" type="button" onClick={() => window.print()} title="결과 인쇄">
                      <Printer size={14} /> <span>인쇄</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {drawError && <div className="error-banner" role="alert" data-testid="status-draw-error">{drawError}</div>}

            {isCounting ? (
              <div className="countdown-card" role="status" aria-live="assertive" data-testid="status-countdown">
                <div className="countdown-number" key={countdown}>{countdown}</div>
                <div className="countdown-copy">
                  <strong>추첨 중</strong>
                  <div className="countdown-track" aria-hidden="true"><span /></div>
                </div>
              </div>
            ) : null}

            {!assignment && !isCounting && (
              <div className="preview-content" data-testid="seat-preview">
                <div className="blackboard" role="img" aria-label="칠판 위치: 좌석 앞쪽">
                  <span>칠판</span>
                </div>
                {validDimensions ? (
                  <div className="grid-scroll">
                    <div className="seat-grid preview-seat-grid" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(57px, 1fr))` }}>
                      {Array.from({ length: seatCount }, (_, index) => {
                        const rowIndex = Math.floor(index / columnCount);
                        const columnIndex = index % columnCount;
                        const seatNumber = index + 1;
                        const isExcluded = excludedSeatNumbers.has(seatNumber);
                        const availablePosition = availableSeatIndices.indexOf(index);
                        const isOmitted = validPool && !isExcluded && availablePosition >= eligibleCount;
                        return (
                          <button
                            className={`seat seat-preview${previewPrioritySeatSet.has(seatNumber) ? ' priority-seat' : ''}${isExcluded ? ' seat-excluded' : ''}${isOmitted ? ' seat-omitted' : ''}`}
                            key={`preview-${index}`}
                            type="button"
                            data-testid={`preview-seat-${seatNumber}`}
                            onClick={() => toggleExcludedSeat(seatNumber)}
                            aria-pressed={isExcluded}
                            aria-label={`좌석 ${seatNumber}번, ${rowIndex + 1}행 ${columnIndex + 1}열${isExcluded ? ', 제외 좌석' : ', 제외 좌석으로 지정하려면 선택'}`}
                          >
                            {isExcluded ? <X className="excluded-seat-icon" size={22} aria-hidden="true" /> : <span className="seat-empty" aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="preview-error" role="status">행과 열을 1부터 20 사이로 입력하면 미리보기가 표시됩니다.</div>
                )}
                {previewPriorityCount > 0 && (
                  <div className="priority-legend"><span className="priority-legend-swatch" />강조색은 앞자리 우선 배정 예정 좌석입니다.</div>
                )}
                {((validPool && eligibleCount === 0) || omittedSeatCount > 0) && (
                  <div className="preview-note" data-testid="text-preview-note">
                    <Info size={14} />
                    <span>{validPool && eligibleCount === 0 ? '배정 가능한 참가자가 없습니다.' : `마지막 ${omittedSeatCount}석 제외 예정`}</span>
                  </div>
                )}
              </div>
            )}

            {assignment && !isCounting && (
              <div className="result-content" data-testid="result-seating-grid">
                <div className="status-card" role="status" aria-live="polite" data-testid="status-draw-complete">
                  <span className="status-indicator" />
                  <p className="status-copy"><strong>{seats.length}석 배정 완료</strong>{omittedSeatCount > 0 ? ` · 마지막 ${omittedSeatCount}석 제외` : ''}</p>
                </div>
                <div className="blackboard" role="img" aria-label="칠판 위치: 좌석 앞쪽">
                  <span>칠판</span>
                </div>
                <div className="grid-scroll">
                  <div className="seat-grid" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(57px, 1fr))` }}>
                    {assignment.map((number, index) => {
                      const rowIndex = Math.floor(index / columnCount);
                      const columnIndex = index % columnCount;
                      const seatNumber = index + 1;
                      const isExcluded = excludedSeatNumbers.has(seatNumber);
                      const isDragged = draggedSeatIndex === index;
                      const isDragTarget = dragOverSeatIndex === index && !isDragged;
                      const dragOffset = isDragged && dragPosition && dragOrigin
                        ? `translate(${dragPosition.x - dragOrigin.x}px, ${dragPosition.y - dragOrigin.y}px) scale(1.04)`
                        : undefined;
                      return (
                        <div
                          className={`seat${number === null ? (isExcluded ? ' seat-excluded' : ' seat-omitted') : ''}${number !== null && frontPriority && prioritySet.has(number) ? ' priority-seat' : ''}${isDragged ? ' seat-dragged' : ''}${isDragTarget ? ' seat-drag-target' : ''}`}
                          key={`${number ?? 'empty'}-${index}`}
                          data-testid={number === null ? `seat-empty-${seatNumber}` : `seat-${number}`}
                          data-seat-index={index}
                          style={{ animationDelay: `${Math.min(index * 28, 480)}ms`, transform: dragOffset, zIndex: isDragged ? 2 : undefined }}
                          onPointerDown={(event) => startSeatPointerDrag(event, index)}
                          onPointerMove={moveSeatPointerDrag}
                          onPointerUp={finishSeatPointerDrag}
                          onPointerCancel={finishSeatPointerDrag}
                          role="listitem"
                          aria-label={number === null
                            ? `${rowIndex + 1}행 ${columnIndex + 1}열, ${isExcluded ? '제외 좌석' : '미배정 좌석'}`
                            : `${rowIndex + 1}행 ${columnIndex + 1}열, 참가자 ${number}번${frontPriority && prioritySet.has(number) ? ', 앞자리 우선 지정 번호' : ''}`}
                        >
                          {number === null
                            ? (isExcluded ? <X className="excluded-seat-icon" size={22} aria-hidden="true" /> : <span className="seat-empty" aria-hidden="true" />)
                            : <>
                                <span className="seat-number">{number}</span>
                              </>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {frontPriority && prioritySet.size > 0 && (
                  <div className="priority-legend"><span className="priority-legend-swatch" />강조색은 앞자리 우선 번호가 배정된 좌석입니다.</div>
                )}
                {excludedSummary.length > 0 && (
                  <div className="result-note" data-testid="text-excluded-note">
                    <Info size={14} />
                    <span>제외 번호: {excludedSummary.join(', ')}</span>
                  </div>
                )}
                {excludedSeatSummary.length > 0 && (
                  <div className="result-note" data-testid="text-excluded-seat-note">
                    <Info size={14} />
                    <span>제외 좌석: {excludedSeatSummary.join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Router() {
  if (window.location.protocol === 'file:') {
    return <Home />;
  }

  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
