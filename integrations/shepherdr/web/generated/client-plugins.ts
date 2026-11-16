// Written by web/build-plugins.ts from web/plugins.json. Do not edit.
import type { ClientPlugin } from '../src/kernel.ts'
import places from '../plugins/places/client.tsx'
import coordinators from '../plugins/coordinators/client.tsx'
import tasks from '../plugins/tasks/client.tsx'
import needs from '../plugins/needs/client.tsx'
import chat from '../plugins/chat/client.tsx'
import reactions from '../plugins/reactions/client.tsx'
import artifacts from '../plugins/artifacts/client.tsx'
import terminal from '../plugins/terminal/client.tsx'
import worktree from '../plugins/worktree/client.tsx'
import browser from '../plugins/browser/client.tsx'
import voice from '../plugins/voice/client.tsx'
import health from '../plugins/health/client.tsx'
import limits from '../plugins/limits/client.tsx'
import alerts from '../plugins/alerts/client.tsx'
import keyboard from '../plugins/keyboard/client.tsx'

export const enabled = ["places","coordinators","tasks","needs","chat","reactions","artifacts","terminal","worktree","browser","voice","health","limits","alerts","keyboard","autopilot"]
export const user: string[] = []
export default [places, coordinators, tasks, needs, chat, reactions, artifacts, terminal, worktree, browser, voice, health, limits, alerts, keyboard] as (ClientPlugin | { name: string; load: () => Promise<{ default: ClientPlugin }> })[]
