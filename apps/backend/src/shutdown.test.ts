import { EventEmitter } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import { registerShutdown } from './shutdown.ts'

function fakeProcess() {
  const proc = Object.assign(new EventEmitter(), {
    exit: vi.fn<(code: number) => void>(),
  })
  return proc
}

function fakeApp(close: () => Promise<void> = async () => {}) {
  return { close: vi.fn(close), log: { info: vi.fn(), error: vi.fn() } }
}

describe('завершение сервера по сигналу', () => {
  test.each(['SIGTERM', 'SIGINT'] as const)(
    '%s — сервер закрывается, процесс завершается с кодом 0',
    async (signal) => {
      const proc = fakeProcess()
      const app = fakeApp()
      registerShutdown(app, proc)

      proc.emit(signal, signal)

      await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(0))
      expect(app.close).toHaveBeenCalledOnce()
    },
  )

  test('повторный сигнал во время закрытия — выход с ненулевым кодом без второго закрытия', () => {
    const proc = fakeProcess()
    const app = fakeApp(() => new Promise(() => {}))
    registerShutdown(app, proc)

    proc.emit('SIGTERM', 'SIGTERM')
    proc.emit('SIGINT', 'SIGINT')

    expect(proc.exit).toHaveBeenCalledWith(1)
    expect(app.close).toHaveBeenCalledOnce()
  })

  test('ошибка закрытия — выход с ненулевым кодом', async () => {
    const proc = fakeProcess()
    const app = fakeApp(() => Promise.reject(new Error('close failed')))
    registerShutdown(app, proc)

    proc.emit('SIGTERM', 'SIGTERM')

    await vi.waitFor(() => expect(proc.exit).toHaveBeenCalledWith(1))
    expect(proc.exit).not.toHaveBeenCalledWith(0)
  })
})
