import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  AlertCircle,
  Check,
  Info,
  LayoutGrid,
  Shuffle,
  TicketCheck,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

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

function Home() {
  const [rows, setRows] = useState('5');
  const [columns, setColumns] = useState('6');
  const [participantCount, setParticipantCount] = useState('30');
  const [excludedText, setExcludedText] = useState('');
  const [frontPriority, setFrontPriority] = useState(true);
  const [priorityText, setPriorityText] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [assignment, setAssignment] = useState<number[] | null>(null);
  const [drawError, setDrawError] = useState('');
  const timeoutIds = useRef<number[]>([]);

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
  const actualSeatCount = validDimensions && validPool ? Math.min(seatCount, eligibleCount) : seatCount;
  const omittedSeatCount = validDimensions && validPool ? Math.max(0, seatCount - eligibleCount) : 0;
  const unavailablePriorityNumbers = priority.numbers.filter((number) => excludedSet.has(number));
  const prioritySeatOverflow = priority.numbers.length > actualSeatCount;
  const prioritySet = useMemo(() => new Set(priority.numbers), [priority.numbers]);
  const previewPriorityCount = frontPriority
    && priority.invalid.length === 0
    && unavailablePriorityNumbers.length === 0
    && !prioritySeatOverflow
    ? priority.numbers.length
    : 0;

  useEffect(() => () => {
    timeoutIds.current.forEach(window.clearTimeout);
  }, []);

  const cancelCountdown = () => {
    timeoutIds.current.forEach(window.clearTimeout);
    timeoutIds.current = [];
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
    if (eligibleCount === 0) {
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
        const seatsToFill = Math.min(seatCount, pool.length);
        const prioritized = frontPriority ? shuffle(priority.numbers) : [];
        const prioritizedSet = new Set(prioritized);
        const remaining = shuffle(pool.filter((number) => !prioritizedSet.has(number)))
          .slice(0, seatsToFill - prioritized.length);
        const selected = [...prioritized, ...remaining];
        setAssignment(frontPriority ? selected : shuffle(selected));
        setCountdown(null);
        setDrawError('');
        timeoutIds.current = [];
      }, 3000),
    ];
  };

  const isCounting = countdown !== null;
  const seats = assignment ?? [];
  const excludedSummary = [...excludedSet].sort((a, b) => a - b);

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

            <div className="priority-settings">
              <label className="priority-box" htmlFor="front-priority">
                <input id="front-priority" data-testid="toggle-front-priority" type="checkbox" checked={frontPriority} onChange={(event) => { setFrontPriority(event.target.checked); setAssignment(null); setDrawError(''); }} disabled={isCounting} />
                <span className="switch" aria-hidden="true" />
                <span>
                  <span className="priority-copy">앞자리 우선</span>
                </span>
              </label>

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
                  disabled={!frontPriority || isCounting}
                  aria-invalid={frontPriority && (priority.invalid.length > 0 || unavailablePriorityNumbers.length > 0 || prioritySeatOverflow)}
                  aria-describedby="priority-helper"
                />
                {frontPriority && priority.invalid.length > 0 && (
                  <div className="validation-message" role="alert" data-testid="status-priority-validation">
                    <AlertCircle size={13} />
                    <span>{priority.invalid.join(', ')}은(는) 1부터 {validPool ? poolCount : 500} 사이의 정수가 아니에요.</span>
                  </div>
                )}
                {frontPriority && unavailablePriorityNumbers.length > 0 && (
                  <div className="validation-message" role="alert" data-testid="status-priority-excluded">
                    <AlertCircle size={13} />
                    <span>제외 번호에 포함된 {unavailablePriorityNumbers.join(', ')}번은 앞자리 우선 번호로 사용할 수 없어요.</span>
                  </div>
                )}
                {frontPriority && prioritySeatOverflow && (
                  <div className="validation-message" role="alert" data-testid="status-priority-capacity">
                    <AlertCircle size={13} />
                    <span>앞자리 우선 번호가 배정 가능한 좌석 {actualSeatCount}개보다 많아요.</span>
                  </div>
                )}
                <p className="helper" id="priority-helper">
                  {frontPriority
                    ? '지정한 번호는 무작위로 앞자리에 배정됩니다.'
                    : '앞자리 우선 설정을 켜면 번호를 입력할 수 있어요.'}
                </p>
              </div>
            </div>

            <button className="primary-button" type="button" data-testid="button-generate" onClick={generate} disabled={isCounting}>
              {isCounting ? <><span className="button-count">{countdown}</span>초</> : <><Shuffle size={16} />{assignment ? '다시 뽑기' : '추첨하기'}</>}
            </button>
          </section>

          <section className="panel result-panel" aria-labelledby="result-title">
            <div className="result-heading">
              <div>
                <h2 className="result-title" id="result-title">{assignment ? '추첨 결과' : '자리 미리보기'}</h2>
              </div>
              <div className="result-count" data-testid="text-seat-count"><LayoutGrid size={13} /><b>{assignment ? seats.length : actualSeatCount}</b>석</div>
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
                        const isOmitted = validPool && index >= eligibleCount;
                        return (
                          <div
                            className={`seat seat-preview${index < previewPriorityCount ? ' priority-seat' : ''}${isOmitted ? ' seat-omitted' : ''}`}
                            key={`preview-${index}`}
                            data-testid={`preview-seat-${index + 1}`}
                            aria-label={`좌석 ${index + 1}번, ${rowIndex + 1}행 ${columnIndex + 1}열${index < previewPriorityCount ? ', 앞자리 우선 배정 예정' : ''}${isOmitted ? ', 인원에 맞춰 제외 예정' : ''}`}
                          >
                            <span className="seat-number">{String(index + 1).padStart(2, '0')}</span>
                          </div>
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
                    {seats.map((number, index) => {
                      const rowIndex = Math.floor(index / columnCount);
                      const columnIndex = index % columnCount;
                      return (
                        <div
                          className={`seat${frontPriority && prioritySet.has(number) ? ' priority-seat' : ''}`}
                          key={`${number}-${index}`}
                          data-testid={`seat-${number}`}
                          style={{ animationDelay: `${Math.min(index * 28, 480)}ms` }}
                          aria-label={`${rowIndex + 1}행 ${columnIndex + 1}열, 참가자 ${number}번${frontPriority && prioritySet.has(number) ? ', 앞자리 우선 지정 번호' : ''}`}
                        >
                          <span className="seat-number">{number}</span>
                          <span className="seat-label">{rowIndex + 1}행 · {columnIndex + 1}열</span>
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
