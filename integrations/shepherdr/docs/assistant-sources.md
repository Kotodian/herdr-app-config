# Panel attachments in the Assistant

TAPD Bug and GitHub Issues panels offer **加入 Assistant** on both list cards
and detail pages. The action reads a snapshot into the current Space's
Assistant draft. Existing text, attachments and quotes stay in place. The
person can preview or remove the new attachment before sending their next
message. Adding an attachment does not send a message, create a task, or
update the source Bug or Issue.

Open the target Space's Assistant in Chat mode first and wait for its draft
to load. A missing or unavailable Assistant produces a visible panel error.
Worker chats do not receive panel requests.

The window's `drag_paths` API targets terminals; its `on_drop` callback accepts
external files. They do not form an internal panel-to-chat drag channel.
The panels therefore use the supported `shared` / `setShared` API instead.

`source-assistant.js` advertises a short-lived destination under
`context.assistant.<space>` with a view token and draft identity. Both panels
submit a reference under `context.request.<space>` and show its acknowledgement.
Only one reference is read per Space at a time. Old view tokens, expired
requests, closed chats, and Space or draft changes cannot redirect an attachment
to another conversation. GitHub reads also retain the selected repository
and machine context.

The receiver reuses `attach.droppedFile`, including the existing read-only
TAPD bridge and GitHub repository validation. References contain no source body
or credentials. Duplicate source URLs are acknowledged without adding a second
snapshot; the twenty-attachment limit is checked before and after reading.
Sending is blocked while a panel attachment is being read.

Run the focused regression from the configuration repository root:

```sh
bun test integrations/shepherdr/service/source-assistant.test.ts
```

The tests use synthetic references, a simulated snapshot reader and UI event
builders. They do not prove delivery into a real user's draft.
