// Проверка сообщений коммитов по Conventional Commits.
// Используется в Git-хуке commit-msg (hk) и при проверке диапазона коммитов.
export default {
  extends: ['@commitlint/config-conventional'],
}
