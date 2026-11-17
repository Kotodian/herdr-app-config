import { beforeEach, expect, mock, test } from 'bun:test'
import { fakeHerdr } from './fake-herdr.ts'
import { built, byId, handler, fakeGpuiBase, fakeGpuiKit } from './fake-gpui.ts'
import { patchRows } from '../core/pr-diff.js'

let calls: string[][] = []
let answer: unknown
mock.module('herdr', () => fakeHerdr({
  appHome: () => '/tmp/test-app',
  theme: () => ({ input: '#333', background: '#222', foreground: '#eee' }),
  props: () => ({ where: { ref: 'TEST-1', folder: '/tmp/repo' } }),
  exec: async (_cmd: string, args: string[]) => {
    calls.push(args)
    return { code: 0, stdout: JSON.stringify(answer), stderr: '' }
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
beforeEach(() => { calls = [] })

test('a GitHub merge queue result never claims the PR already merged', async () => {
  answer = { state: 'ready', accepted: 'queue' }
  const view = make()
  await view.action('merge', cx)
  expect(view.current.state).toBe('ready')
  expect(view.message).toContain('尚未合并')
  expect(calls[0]).toContain('accept')
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
