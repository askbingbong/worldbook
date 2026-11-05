import { dismissToast, useStore } from '../store/store'

export default function Toasts() {
  const { toast } = useStore()
  if (!toast) return null
  return (
    <div className="toast" role="status" aria-live="polite" key={toast.id}>
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          className="btn ghost"
          onClick={() => {
            toast.undo?.()
            dismissToast()
          }}
        >
          Undo
        </button>
      )}
    </div>
  )
}
