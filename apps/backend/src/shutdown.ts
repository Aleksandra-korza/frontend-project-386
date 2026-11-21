type ClosableApp = {
  close(): Promise<unknown>
  log: { info(msg: string): void; error(err: unknown, msg?: string): void }
}

type SignalProcess = {
  on(
    signal: NodeJS.Signals,
    listener: (signal: NodeJS.Signals) => void,
  ): unknown
  exit(code: number): void
}

const SIGNALS = ['SIGTERM', 'SIGINT'] as const

/**
 * Корректное завершение по SIGTERM (docker stop, Render) и SIGINT (Ctrl+C):
 * сервер закрывается, процесс выходит с кодом 0. В контейнере Node — PID 1,
 * без обработчика сигнал игнорируется и остановка ждёт таймаута.
 */
export function registerShutdown(app: ClosableApp, proc: SignalProcess): void {
  let closing = false

  const onSignal = async (signal: NodeJS.Signals) => {
    // Повторный сигнал — не ждать закрытия, выйти сразу (без второго close).
    if (closing) {
      app.log.error(`${signal} received again, exiting immediately`)
      proc.exit(1)
      return
    }
    closing = true
    app.log.info(`${signal} received, closing server`)
    try {
      await app.close()
    } catch (err) {
      app.log.error(err, 'failed to close server')
      proc.exit(1)
      return
    }
    app.log.info('server closed')
    proc.exit(0)
  }

  for (const signal of SIGNALS) {
    proc.on(signal, (received) => void onSignal(received))
  }
}
