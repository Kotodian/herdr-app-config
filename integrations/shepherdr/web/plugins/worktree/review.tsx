import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { act } from '@client/kernel.ts'
import { Dialog } from '@client/rowmenu.tsx'
import { patchRows, fileTree, reviewItems, diffMode } from '@core/pr-diff.js'
import { colorDiff, codeSpans, syntaxColor } from '@core/pr-syntax.js'
import type { Task } from '@shared/types.ts'

type ChangedFile = { path: string; status: string; add: number; del: number }
type Comment = { id: string; snapshot: string; head: string; path?: string; line?: number; side: 'LEFT' | 'RIGHT'; body: string; status: string }
type Target = { snapshot: string; path: string; line: number; side: 'LEFT' | 'RIGHT' }
type Review = {
  snapshot: string; head: string; merge_base: string; base: string; branch: string; state: string
  approved: boolean; approval?: unknown; dirty: string[]; local_matches: boolean; limited: boolean
  files: ChangedFile[]; file_count: number; add: number; delete: number
  comments: Comment[]
  title?: string; pr?: { number?: number }; pr_url?: string
  patch?: { text: string; binary: boolean; limited: boolean }
}
type Side = { number: number; text: string } | null
type Row = { kind: string; text?: string; left?: Side; right?: Side; inline?: { left: string[]; right: string[] } | null }
type ReviewItem = { kind: string; key: string; row: Row; index: number; height: number; comments?: Comment[]; editing?: boolean }

let opened: string | null = null
const listeners = new Set<() => void>()
export function openPrReview(task: string) { opened = task; listeners.forEach((f) => f()) }
function close() { opened = null; listeners.forEach((f) => f()) }
const btn = 'rounded px-3 py-1.5 text-xs hover:bg-hover disabled:opacity-40 disabled:cursor-default'
const primary = `${btn} bg-sel font-medium`
const HEIGHT = 23

const commentStatus: Record<string, string> = { draft: '草稿', changes: '已要求修改', resolved: '已审核解决', commented: '审核意见' }
type DiffProps = {
  patch?: Review['patch']; mode: 'split' | 'unified'; path: string; snapshot?: string; working: boolean
  comments: Comment[]; target: Target | null; body: string; busy: string
  onComment: (row: Row) => void; onBody: (body: string) => void
  onSave: (remove?: string) => void; onCancel: () => void
}
function Diff({ patch, mode, path, snapshot, working, comments, target, body, busy, onComment, onBody, onSave, onCancel }: DiffProps) {
  const parsed = useMemo(() => colorDiff(patchRows(patch?.text ?? ''), path), [patch?.text, path])
  const displayMode = diffMode(parsed, mode)
  const rows = parsed[displayMode as 'split' | 'unified'] as Row[]
  const items = reviewItems(rows, working ? [] : comments, working ? null : target, snapshot, path) as ReviewItem[]
  let total = 0
  const offsets = items.map((item) => { const y = total; total += item.height; return y })
  const hunks = items.flatMap((item, i) => item.kind === 'code' && item.row.kind === 'hunk' ? [i] : [])
  const [top, setTop] = useState(0), [height, setHeight] = useState(700), [hunk, setHunk] = useState(-1)
  const scroller = useRef<HTMLDivElement>(null)
  const width = rows.reduce((w, r) => Math.max(w, (Math.max(r.left?.text.length ?? 0, r.right?.text.length ?? 0) * 7.5) + 64), 360)
  useEffect(() => {
    setTop(0); setHunk(-1)
    if (scroller.current) scroller.current.scrollTop = 0
  }, [path, mode, patch?.text])
  useEffect(() => {
    if (!target || !scroller.current) return
    const at = items.findIndex((item) => item.kind === 'thread' && item.editing)
    if (at >= 0 && (offsets[at] < scroller.current.scrollTop || offsets[at] + items[at].height > scroller.current.scrollTop + height))
      scroller.current.scrollTop = Math.max(0, offsets[at] - 60)
  }, [target?.line, target?.side, target?.snapshot])
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const observer = new ResizeObserver(() => setHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const navigate = (delta: number) => {
    const next = Math.max(0, Math.min(hunks.length - 1, hunk + delta))
    setHunk(next)
    if (scroller.current) scroller.current.scrollTop = offsets[hunks[next]]
  }
  const first = offsets.findIndex((y, i) => y + items[i].height > top)
  const start = Math.max(0, first - 8)
  let end = start
  while (end < items.length && offsets[end] < top + height + 300) end++
  const cell = (side: Side | undefined, pieces: string[] | undefined, changed: boolean, left: boolean) => (
    <div className={clsx('flex min-w-0', changed && side && (left ? 'bg-red-400/10' : 'bg-green-400/10'), !side && 'bg-sel/50')}>
      <span className="w-12 shrink-0 pr-3 text-right text-fg3 select-none">{side?.number ?? ''}</span>
      <code className="pl-3 whitespace-pre">{codeSpans(side, pieces).map((span: { text: string; scope: string; changed: boolean }, i: number) =>
        <span key={i} className={clsx('pr-syntax', span.changed && (left ? 'bg-red-400/25' : 'bg-green-400/25'))}
          style={{ '--syntax-dark': syntaxColor(span.scope) || 'inherit', '--syntax-light': syntaxColor(span.scope, true) || 'inherit' } as React.CSSProperties}>{span.text}</span>)}</code>
    </div>
  )
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-3 text-xs">
        <span className="min-w-0 flex-1 truncate">{path || '选择一个变更文件'}</span>
        <button className={btn} disabled={!hunks.length} onClick={() => navigate(-1)} aria-label="上一个差异">↑</button>
        <span className="text-fg3">{hunks.length ? `${hunk + 1}/${hunks.length}` : ''}</span>
        <button className={btn} disabled={!hunks.length} onClick={() => navigate(1)} aria-label="下一个差异">↓</button>
      </div>
      <div ref={scroller} onScroll={(e) => setTop(e.currentTarget.scrollTop)} className="relative min-h-0 flex-1 overflow-auto font-mono text-xs" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'F7') { e.preventDefault(); navigate(e.shiftKey ? -1 : 1) } }}>
        {!rows.length ? <p className="p-5 text-fg3">{patch?.binary ? '二进制文件，无法显示文本 Diff' : patch ? '没有文本差异' : '正在读取代码…'}</p> : (
          <div className="relative min-w-full" style={{ height: total, width: width * (displayMode === 'split' ? 2 : 1) + 24 }}>
            {items.slice(start, end).map((item, i) => {
              const row = item.row
              return <div key={item.key} className="absolute left-0 flex w-full" style={{ top: offsets[start + i], height: item.height }}>
                {item.kind === 'thread' ? <div className={clsx('shrink-0 bg-sel/40 py-1 pl-6 pr-3', displayMode === 'split' ? 'w-1/2' : 'w-full')}>
                  {item.comments?.map((c: Comment) => <div key={c.id} className="flex h-[100px] flex-col gap-1 border-l-2 border-work-fg bg-bg p-2 font-sans">
                    <div className="flex items-center text-fg3"><span className="flex-1">{commentStatus[c.status] ?? c.status} · 第 {c.line} 行</span>
                      {c.status === 'draft' ? <button className={btn} disabled={!!busy} onClick={() => onSave(c.id)}>删除</button> : null}</div>
                    <p className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words">{c.body}</p>
                  </div>)}
                  {item.editing && target ? <div className="flex h-[210px] flex-col gap-2 border-l-2 border-work-fg bg-bg p-3 font-sans">
                    <span className="text-work-fg">第 {target.line} 行</span>
                    <textarea autoFocus aria-label="行评论" className="min-h-0 flex-1 resize-none rounded bg-sel p-2 outline-none" placeholder="写下需要修改的地方…" value={body} onChange={(e) => onBody(e.target.value)} />
                    <div className="flex gap-2"><button className={primary} disabled={!!busy || !body.trim()} onClick={() => onSave()}>{busy === 'comment' ? '保存中…' : '保存评论'}</button>
                      <button className={btn} disabled={!!busy} onClick={onCancel}>取消</button></div>
                  </div> : null}
                </div> : <>
                  <div className="w-6 shrink-0 select-none text-center text-work-fg" style={{ lineHeight: `${HEIGHT}px` }}>
                    {row.kind !== 'hunk' && !working ? <button aria-label={`评论第 ${(row.right ?? row.left)?.number} 行`} className="h-full w-full hover:bg-sel" onClick={() => onComment(row)}>+</button> : null}
                  </div>
                  <div className={clsx('min-w-0 flex-1', row.kind === 'hunk' ? 'bg-sel px-4 text-fg3' : 'grid')} style={{ lineHeight: `${HEIGHT}px`, gridTemplateColumns: displayMode === 'split' ? '1fr 1fr' : '1fr' }}>
                    {row.kind === 'hunk' ? row.text : displayMode === 'split' ? <>{cell(row.left, row.inline?.left, row.kind !== 'context', true)}{cell(row.right, row.inline?.right, row.kind !== 'context', false)}</>
                      : cell(row.right ?? row.left, undefined, row.kind !== 'context', row.kind === 'delete')}
                  </div>
                </>}
              </div>
            })}
          </div>
        )}
      </div>
      {patch?.limited ? <p className="p-2 text-xs text-need-fg">文件过大，预览已截断，当前不能审核。</p> : null}
    </div>
  )
}

function ReviewContent({ task, wide = false }: { task: string; wide?: boolean }) {
  const [data, setData] = useState<Review | null>(null), [detail, setDetail] = useState<Review | null>(null)
  const [working, setWorking] = useState(false), [path, setPath] = useState(''), [query, setQuery] = useState('')
  const [mode, setMode] = useState<'split' | 'unified'>('split')
  const [nonce, refresh] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(''), [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState(''), [target, setTarget] = useState<Target | null>(null)
  const [folded, setFolded] = useState<string[]>([])
  useEffect(() => {
    let gone = false
    const read = async () => {
      setLoading(true)
      try {
        const result = await act({ type: 'review-diff', task, working }) as Review
        if (!gone) {
          setData(result); setError('')
          setPath((old) => result.files.some((f) => f.path === old) ? old : result.files[0]?.path ?? '')
        }
      } catch (e) { if (!gone) setError(String((e as Error).message ?? e)) }
      finally { if (!gone) setLoading(false) }
    }
    void read()
    const timer = setInterval(() => { if (!document.hidden) void read() }, 15_000)
    return () => { gone = true; clearInterval(timer) }
  }, [task, working, nonce])
  useEffect(() => {
    let gone = false
    setDetail(null)
    if (!path) return
    act({ type: 'review-diff', task, working, path }).then((out) => {
      if (!gone) setDetail(out as Review)
    }, (e) => { if (!gone) setError(String(e.message ?? e)) })
    return () => { gone = true }
  }, [task, working, path, data?.snapshot, nonce])
  useEffect(() => { setMessage('') }, [data?.snapshot])
  const ready = !!data && data.state === 'ready' && !data.dirty.length && data.local_matches && !data.limited
    && !working && !loading && !busy && !detail?.patch?.limited && (detail?.snapshot === data.snapshot || !data.files.length)
  const action = async (kind: 'approve' | 'merge' | 'changes') => {
    if (!data || busy || working || (kind === 'changes' ? data.state !== 'ready' : !ready)) return
    setBusy(kind); setError('')
    try {
      if (kind === 'approve') {
        const result = await act({ type: 'approve-review', task, snapshot: data.snapshot }) as Review
        setData((old) => old?.snapshot === result.snapshot ? { ...old, ...result } : old)
        setMessage('')
      } else if (kind === 'changes') {
        const result = await act({ type: 'request-changes', task, snapshot: data.snapshot }) as Review
        setData((old) => ({ ...old!, ...result }))
        setMessage('已要求修改 · Worker 将逐条处理评论，完成后请重新审核')
      } else {
        const out = await act({ type: 'accept', task } as never) as { state?: string; accepted?: string }
        setMessage(out.state === 'done' ? '已审核并完成合并' : out.accepted === 'queue' ? '已加入 GitHub 合并队列，尚未合并' : '合并请求已提交，正在等待检查或 GitHub 审核')
        refresh((n) => n + 1)
      }
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setBusy('') }
  }
  const saveComment = async (remove?: string) => {
    if (!data || busy || working || (!remove && (!body.trim() || !target))) return
    if (!remove && target && target.snapshot !== data.snapshot) { setError('代码版本已变化，请重新选择评论行。输入的评论已保留。'); return }
    setBusy('comment'); setError('')
    try {
      const out = await act({ type: 'review-comment', task, snapshot: data.snapshot, ...(remove ? { remove } : {
        body, ...(target ? { path: target.path, line: target.line, side: target.side } : path ? { path } : {}),
      }) }) as Review
      setData((old) => ({ ...old!, ...out }))
      if (!remove) { setBody(''); setTarget(null) }
    } catch (e) { setError(String((e as Error).message ?? e)) }
    finally { setBusy('') }
  }
  const comments = data?.comments ?? []
  const drafts = comments.filter((c) => c.snapshot === data?.snapshot && c.status === 'draft')
  const files = fileTree(data?.files ?? [], query, folded) as { kind: string; path: string; name: string; depth: number; folded?: boolean; count?: number; file?: ChangedFile }[]
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-xs">
        <button className={clsx(btn, !working && 'bg-sel')} disabled={!!busy} onClick={() => setWorking(false)}>本地 Commit</button>
        <button className={clsx(btn, working && 'bg-sel')} disabled={!!busy} onClick={() => setWorking(true)}>Worktree 实时</button>
        <span className="flex-1 text-fg3">{data?.file_count ?? 0} files</span>
        <span className="text-ready-fg">+{data?.add ?? 0}</span><span className="text-need-fg">−{data?.delete ?? 0}</span>
        <button className={btn} disabled={loading || !!busy} onClick={() => refresh((n) => n + 1)}>刷新</button>
        {wide ? <span className="text-fg3">点击行号左侧 +，在该行上方评论</span> : null}
      </div>
      {data ? <div className="flex shrink-0 flex-wrap items-center gap-3 px-3 py-2 text-xs">
        <span className="min-w-0 flex-1 truncate">{data.pr?.number ? `#${data.pr.number} · ` : ''}{data.title}</span>
        {data.pr_url ? <a href={data.pr_url} target="_blank" rel="noreferrer" className={btn}>Open on GitHub</a> : null}
      </div> : null}
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2 text-xs">
        <span className="min-w-0 flex-1 truncate text-fg3">{data ? `${data.branch} → ${data.base}` : '正在读取本地 Commit…'}</span>
        {wide ? <>
          <button className={clsx(btn, mode === 'split' && 'bg-sel')} onClick={() => setMode('split')}>左右对比</button>
          <button className={clsx(btn, mode === 'unified' && 'bg-sel')} onClick={() => setMode('unified')}>统一视图</button>
        </> : <button className={primary} onClick={() => openPrReview(task)}>查看 Diff 并审核</button>}
      </div>
      {data && (data.dirty.length || !data.local_matches) ? <p className="shrink-0 px-3 py-2 text-xs text-need-fg">{data.local_matches ? `Worktree 另有 ${data.dirty.length} 个未提交文件` : 'Worktree 与任务分支的本地 Commit 不同，请检查分支并刷新'}</p> : null}
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className={clsx('flex min-h-0 shrink-0 flex-col border-r border-line', wide ? 'w-60 phone:w-36' : 'w-full')}>
          <input aria-label="搜索变更文件" className="m-2 min-w-0 rounded bg-sel px-2 py-2 text-xs outline-none" placeholder="搜索变更文件" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {files.map((node) => node.kind === 'directory' ? <button key={node.path} style={{ paddingLeft: 10 + node.depth * 14 }}
              className="flex w-full items-center gap-2 py-2 pr-3 text-left text-xs hover:bg-hover"
              onClick={() => setFolded((old) => old.includes(node.path) ? old.filter((p) => p !== node.path) : [...old, node.path])}>
              <span className="text-fg3">{node.folded ? '›' : '⌄'}</span><span className="min-w-0 flex-1 truncate">{node.name}</span><span className="text-fg3">{node.count}</span>
            </button> : <button key={node.path} style={{ paddingLeft: 26 + node.depth * 14 }} className={clsx('flex w-full items-start gap-2 py-2 pr-3 text-left text-xs hover:bg-hover', path === node.path && 'bg-sel')}
              onClick={() => { setPath(node.path); setTarget(null); if (!wide) openPrReview(task) }}>
              <span className={node.file!.status === 'A' ? 'text-ready-fg' : node.file!.status === 'D' ? 'text-need-fg' : 'text-work-fg'}>{node.file!.status}</span>
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
              <span className="shrink-0"><span className="text-ready-fg">+{node.file!.add}</span><br /><span className="text-need-fg">−{node.file!.del}</span></span>
            </button>)}
            {!files.length ? <p className="p-4 text-xs text-fg3">{loading ? '正在读取…' : '没有代码差异'}</p> : null}
          </div>
        </div>
        {wide ? <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="grid shrink-0 grid-cols-2 border-b border-line px-3 py-2 text-xs text-fg3"><span>基准 · {data?.merge_base.slice(0, 8)}</span><span>{working ? '当前 Worktree' : `本地 Commit · ${data?.head.slice(0, 8) ?? ''}`}</span></div>
          <Diff patch={detail?.patch} path={path} mode={mode} snapshot={detail?.snapshot} working={working} comments={comments} target={target} body={body} busy={busy}
            onBody={setBody} onSave={(remove) => void saveComment(remove)} onCancel={() => { setBody(''); setTarget(null) }}
            onComment={(row) => {
              if (working || !detail) return
              const side = row.right ? 'RIGHT' : 'LEFT', line = (row.right ?? row.left)!.number
              if (body.trim() && target && (target.line !== line || target.side !== side)) { setError('请先保存或取消正在编辑的评论。'); return }
              setTarget({ snapshot: detail.snapshot, path, line, side })
            }} />
        </div> : null}
      </div>
      {error ? <p role="alert" className="max-h-24 shrink-0 overflow-auto px-3 py-2 text-xs text-need-fg">{error}</p> : null}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line px-3 py-3 text-xs">
        <span className="min-w-0 flex-1 text-fg3">{message || (data?.approved ? `已审核 ${data.head.slice(0, 8)}` : data?.approval ? '版本已变化，之前的审核已失效' : '待人工审核 · 审核通过后才能合并')}</span>
        {wide ? <>
          <button className={primary} disabled={!!busy || !drafts.length || data?.state !== 'ready' || working || loading || !!message} onClick={() => void action('changes')}>要求修改 · {drafts.length} 条评论</button>
          <button className={primary} disabled={!ready || data?.approved} onClick={() => void action('approve')}>{busy === 'approve' ? '正在记录…' : data?.approved ? '已审核通过' : '审核通过'}</button>
          <button className={primary} disabled={!ready || !data?.approved || !!message} onClick={() => void action('merge')}>{busy === 'merge' ? '正在合并…' : `合并到 ${data?.base ?? ''}`}</button>
        </> : null}
      </div>
    </div>
  )
}

export function PrReview({ task }: { task: Task }) { return <ReviewContent key={task.id} task={task.id} /> }
export function PrReviewDialog() {
  const task = useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f) }, () => opened)
  if (!task) return null
  return <Dialog title="PR · Diff 审核" closer large maxWidth="96vw" safe cancel="关闭" onCancel={close} buttons={null}>
    <ReviewContent key={task} task={task} wide />
  </Dialog>
}
