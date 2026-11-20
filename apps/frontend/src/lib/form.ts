/** Чтение значений формы action: строковое значение поля или '' (поле пусто, нет поля, файл). */
export const formText = (form: FormData) => (name: string) => {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}
