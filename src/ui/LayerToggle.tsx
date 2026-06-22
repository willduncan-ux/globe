import { layerAccent, type LayerId } from '@/design/tokens'

interface LayerToggleProps {
  layer: LayerId
  checked: boolean
  disabled?: boolean
  label: string
  onChange: () => void
}

/**
 * A custom switch tinted to its layer's accent, so flipping it both controls
 * the layer and shows its colour in the legend. Built on a real button with
 * switch semantics for keyboard and screen-reader support.
 */
export function LayerToggle({
  layer,
  checked,
  disabled = false,
  label,
  onChange,
}: LayerToggleProps) {
  const accent = layerAccent[layer]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="group relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-35"
      style={{
        backgroundColor: checked ? accent : 'rgba(233,238,248,0.12)',
      }}
    >
      <span
        className="h-5 w-5 rounded-full bg-frost shadow-sm transition-transform duration-300 ease-out will-change-transform"
        style={{
          transform: checked ? 'translateX(18px)' : 'translateX(0)',
        }}
      />
    </button>
  )
}
