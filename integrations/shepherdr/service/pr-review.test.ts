import { beforeEach, expect, mock, test } from 'bun:test'
import { fakeHerdr } from './fake-herdr.ts'
import { built, byId, handler, fakeGpuiBase, fakeGpuiKit } from './fake-gpui.ts'
import { patchRows } from '../core/pr-diff.js'

let calls: string[][] = []
let answer: unknown
let fail = ''
let overlays: any[] = []
mock.module('herdr', () => fakeHerdr({
  appHome: () => '/tmp/test-app',
  theme: () => ({ input: '#333', background: '#222', foreground: '#eee' }),
  props: () => ({ where: { ref: 'TEST-1', folder: '/tmp/repo' } }),
  openOverlay: (spec: unknown) => { overlays.push(spec); return 'test-overlay' },
  exec: async (_cmd: string, args: string[]) => {
    calls.push(args)
    return { code: fail ? 1 : 0, stdout: JSON.stringify(answer), stderr: fail }
  },
}))
mock.module('gpui-kit', () => fakeGpuiKit())
mock.module('gpui-base', () => fakeGpuiBase())
const { default: PullRequest } = await import('../mods/task-pr/main.js')
const jobs: Promise<unknown>[] = []
const cx = {
  notify() {}, stop_propagation() {}, new: () => ({ release() {} }),
  spawn(fn: (cx: any) => Promise<unknown>) { const job = fn(cx); jobs.push(job); return job },
}
const make = () => {
  let body = ''
  return Object.assign(Object.create(PullRequest.prototype), {
    fixed: { ref: 'TEST-1', folder: '/tmp/repo' }, working: false, busy: false, host: cx, threads: new Map(),
    current: { snapshot: 'abc', state: 'ready', files: [], comments: [] }, rows: [], mode: 'split',
    commentBox: { value: () => body, set_value: (v: string) => { body = v }, focus() {} },
    scroll: { scroll_to_item() {} }, refresh() {},
  })
}
beforeEach(() => { calls = []; fail = ''; overlays = [] })

test('approval hands merging to the Assistant without a separate merge action', async () => {
  answer = { state: 'ready', approved: true, head: '123456789', handoff: { state: 'sent' } }
  const view = make()
  await view.action('approve', cx)
  expect(view.current.state).toBe('ready')
  expect(view.approvalText()).toContain('已交给 Assistant 合并')
  expect(view.approvalText()).toContain('等待执行结果')
  expect(calls[0]).toContain('approve-review')
  await view.action('merge', cx)
  expect(calls).toHaveLength(1)
})

test('request changes preserves the full returned comment list and returns to Working', async () => {
  answer = { state: 'running', approved: false, comments: [{ id: 'a' }, { id: 'b' }] }
  const view = make()
  await view.action('changes', cx)
  expect(calls[0].slice(0, 4)).toEqual(['request-changes', 'TEST-1', '--snapshot', 'abc'])
  expect(view.current.comments).toHaveLength(2)
  expect(view.current.state).toBe('running')
  expect(view.message).toContain('逐条处理')
})

test('only the left plus gutter opens a line comment, and stale code clicks are refused', () => {
  const view = make()
  view.path = 'code.ts'
  const key = (snapshot: string) => JSON.stringify({ kind: 'code', snapshot, path: 'code.ts', line: 4, side: 'RIGHT' })
  view.pressX = 10
  view.selectLine(key('old'), cx)
  expect(view.commentTarget).toBeUndefined()
  view.pressX = 140
  view.selectLine(key('abc'), cx)
  expect(view.commentTarget).toBeUndefined()
  view.pressX = 10
  view.selectLine(key('abc'), cx)
  expect(view.commentTarget.line).toBe(4)
})

test('the editor saves multiple inline comments and clears after each successful save', async () => {
  const view = make()
  view.path = 'code.ts'; view.patchSnapshot = 'abc'; view.cellWidth = 400
  view.rows = patchRows('@@ -0,0 +1,2 @@\n+first\n+second\n').split
  for (const line of [1, 2]) {
    view.pressX = 10
    view.selectLine(JSON.stringify({ kind: 'code', snapshot: 'abc', path: view.path, line, side: 'RIGHT' }), cx)
    view.commentBox.set_value(`fix ${line}`)
    built.length = 0
    const layout = view.items(), item = layout.find((x: any) => x.editing)
    expect(layout[layout.indexOf(item) + 1].row.right.number).toBe(line)
    view.thread(item.key, { border: '#444', accent: '#aaa', dim: '#888', background: '#222', raised: '#333' }, cx)
    const add = byId('pr-comment-add')
    expect(add).toBeDefined()
    answer = { snapshot: 'abc', comments: [...view.current.comments, { id: `${line}`, snapshot: 'abc', path: view.path, line, side: 'RIGHT', body: `fix ${line}`, status: 'draft' }] }
    handler(add, 'on_click')!({}, cx)
    await Promise.all(jobs.splice(0))
    expect(view.commentBox.value()).toBe('')
    expect(view.commentTarget).toBeNull()
    expect(calls.at(-1)).toContain('--line')
    expect(calls.at(-1)).toContain(String(line))
  }
  expect(view.current.comments).toHaveLength(2)
  expect(view.items().filter((x: any) => x.kind === 'thread')).toHaveLength(2)
})

test('background GitHub polling cannot invalidate and repeatedly clear the displayed file', () => {
  const view = make()
  view.fixed.pr = { repo: 'example/repo', number: 1, checked: 100 }
  const before = view.context()
  view.fixed.pr.checked = 200
  expect(view.context()).toBe(before)
  view.fixed.pr.number = 2
  expect(view.context()).not.toBe(before)
})

test('review comment location opens its immutable original code anchor', () => {
  const view = make()
  view.jumpComment({ id: 'abcdef123456', path: 'src/中文.ts', line: 37, side: 'LEFT' })
  expect(overlays[0].props).toMatchObject({
    wide: true, commentId: 'abcdef123456', path: 'src/中文.ts',
    jumpTarget: { path: 'src/中文.ts', line: 37, side: 'LEFT' },
  })
  view.commentBox.set_value('unsaved')
  view.jumpComment({ id: 'another', path: 'src/other.ts' })
  expect(overlays).toHaveLength(1)
  expect(view.error).toContain('保存或取消')
})

test('original comment snapshot loads locally and centers the matching source row', async () => {
  const view = make(), scrolled: any[] = []
  view.commentId = 'abcdef123456'
  view.jumpTarget = { path: 'code.ts', line: 37, side: 'LEFT' }
  view.fileSeq = 0
  view.scroll.scroll_to_item = (...args: any[]) => scrolled.push(args)
  answer = { snapshot: 'old', files: [{ path: 'code.ts' }], comments: [],
    historical: true, patch: { text: '@@ -36,2 +36,2 @@\n same\n-before\n+after\n' } }
  await view.loadFile('code.ts', cx)
  expect(calls[0]).toContain('--comment-id')
  expect(calls[0]).toContain('abcdef123456')
  const [at, strategy] = scrolled.at(-1)
  expect(view.items()[at].row.left.number).toBe(37)
  expect(strategy).toBe('center')
})

test('historical code cannot receive comments, request changes, approve, or merge', async () => {
  const view = make()
  view.current.historical = true; view.path = 'code.ts'; view.pressX = 10
  view.selectLine(JSON.stringify({ kind: 'code', snapshot: 'abc', path: 'code.ts', line: 1 }), cx)
  expect(view.commentTarget).toBeUndefined()
  view.commentBox.set_value('text')
  view.commentTarget = { line: 1, path: 'code.ts', snapshot: 'abc' }
  view.saveComment(cx)
  view.scope(true, cx)
  for (const action of ['approve', 'changes', 'merge']) await view.action(action, cx)
  expect(calls).toHaveLength(0)
  expect(view.working).toBe(false)
  expect(view.ready()).toBe(false)
})

test('resolve and reopen use the saved comment id while preserving the comparison', async () => {
  const view = make()
  answer = { comments: [{ id: 'abcdef123456', status: 'resolved' }] }
  await view.commentAction({ id: 'abcdef123456', status: 'changes' }, cx)
  expect(calls[0].slice(0, 4)).toEqual(['resolve-review-comment', 'TEST-1', '--comment-id', 'abcdef123456'])
  expect(view.current.snapshot).toBe('abc')
  expect(view.current.comments[0].status).toBe('resolved')
  answer = { comments: [{ id: 'abcdef123456', status: 'changes' }] }
  await view.commentAction({ id: 'abcdef123456', status: 'resolved' }, cx)
  expect(calls[1]).toContain('--reopen')
})

test('failed resolution keeps the original feedback and shows the error', async () => {
  const view = make()
  view.current.comments = [{ id: 'abcdef123456', status: 'changes', body: 'keep' }]
  answer = null; fail = 'GitHub offline'
  await view.commentAction(view.current.comments[0], cx)
  expect(view.current.comments[0]).toEqual({ id: 'abcdef123456', status: 'changes', body: 'keep' })
  expect(view.error).toBe('GitHub offline')
})
